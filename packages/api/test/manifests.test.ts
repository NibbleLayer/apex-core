import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SignedManifestEnvelope } from '@nibblelayer/apex-contracts';
import { manifestRoutes } from '../src/routes/manifests.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { verifyManifestEnvelope } from '../src/services/manifest-signing.js';
import { testDb } from './setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  authHeaders,
  createTestSdkToken,
  createTestEnvironment,
  createTestWallet,
  createTestRoute,
  createTestPriceRule,
} from './helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

async function setupServiceWithManifest() {
  const { orgId, rawKey, serviceId } = await createTestOrgKeyAndService();
  const envId = await createTestEnvironment(serviceId, 'test');
  await createTestWallet(serviceId, envId);
  const routeId = await createTestRoute(serviceId, 'GET', '/api/weather');
  await createTestPriceRule(routeId);
  return { orgId, rawKey, serviceId };
}

describe('GET /services/:id/manifest', () => {
  it('returns manifest for a service with env=test', async () => {
    const { rawKey, serviceId } = await setupServiceWithManifest();

    const res = await manifestRoutes.request(`/services/${serviceId}/manifest?env=test`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.serviceId).toBe(serviceId);
    expect(body.environment).toBe('test');
    expect(body.version).toBe(1);
    expect(body.routes).toBeDefined();
    expect(body.checksum).toBeDefined();
  });

  it('returns 400 when env parameter is missing', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await manifestRoutes.request(`/services/${serviceId}/manifest`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 when env parameter is invalid', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await manifestRoutes.request(`/services/${serviceId}/manifest?env=staging`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for service with no environment', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await manifestRoutes.request(`/services/${serviceId}/manifest?env=test`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await manifestRoutes.request('/services/c_nonexistent/manifest?env=test', {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await manifestRoutes.request('/services/fake/manifest?env=test');

    expect(res.status).toBe(401);
  });

  it('generates manifest on-demand when none exists', async () => {
    const { rawKey, serviceId } = await setupServiceWithManifest();

    // Delete all existing manifests
    const { serviceManifests } = await import('@nibblelayer/apex-persistence/db');
    await testDb.delete(serviceManifests);

    const res = await manifestRoutes.request(`/services/${serviceId}/manifest?env=test`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.serviceId).toBe(serviceId);
    expect(body.version).toBe(1);
  });

  it('keeps legacy manifest response bare', async () => {
    const { rawKey, serviceId } = await setupServiceWithManifest();

    const res = await manifestRoutes.request(`/services/${serviceId}/manifest?env=test`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manifest).toBeUndefined();
    expect(body.signature).toBeUndefined();
    expect(body.serviceId).toBe(serviceId);
  });
});

describe('GET /sdk/manifest', () => {
  it('returns a signed manifest envelope', async () => {
    const { orgId, serviceId } = await setupServiceWithManifest();
    const { rawToken, id: sdkTokenId } = await createTestSdkToken({ orgId, serviceId });

    const res = await manifestRoutes.request('/sdk/manifest', {
      headers: authHeaders(rawToken),
    });

    expect(res.status).toBe(200);

    const parsed = (await res.json()) as SignedManifestEnvelope;
    expect(parsed.manifest.serviceId).toBe(serviceId);
    expect(parsed.signature.alg).toBe('HS256');
    expect(parsed.signature.kid).toBe(sdkTokenId);
    expect(parsed.signature.payloadDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.signature.value).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyManifestEnvelope({ envelope: parsed, rawApiKey: rawToken })).toBe(true);
  });

  it('infers service and environment from the SDK token when query params are missing', async () => {
    const { orgId, serviceId } = await setupServiceWithManifest();
    const { rawToken } = await createTestSdkToken({ orgId, serviceId });

    const res = await manifestRoutes.request('/sdk/manifest', {
      headers: authHeaders(rawToken),
    });

    expect(res.status).toBe(200);
    const parsed = (await res.json()) as SignedManifestEnvelope;
    expect(parsed.manifest.serviceId).toBe(serviceId);
    expect(parsed.manifest.environment).toBe('test');
  });

  it('returns 403 when env query mismatches the SDK token binding', async () => {
    const { orgId, serviceId } = await setupServiceWithManifest();
    const { rawToken } = await createTestSdkToken({ orgId, serviceId, environment: 'test' });

    const res = await manifestRoutes.request(`/sdk/manifest?serviceId=${serviceId}&env=prod`, {
      headers: authHeaders(rawToken),
    });

    expect(res.status).toBe(403);
  });

  it('returns 403 when serviceId query mismatches the SDK token binding', async () => {
    const { orgId, serviceId } = await setupServiceWithManifest();
    const { rawToken } = await createTestSdkToken({ orgId, serviceId });

    const res = await manifestRoutes.request('/sdk/manifest?serviceId=svc_other&env=test', {
      headers: authHeaders(rawToken),
    });

    expect(res.status).toBe(403);
  });

  it('returns 401 without authentication', async () => {
    const res = await manifestRoutes.request('/sdk/manifest?serviceId=fake&env=test');

    expect(res.status).toBe(401);
  });
});
