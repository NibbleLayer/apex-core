import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { manifestRoutes } from '../src/routes/manifests.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  jsonAuthHeaders,
  authHeaders,
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
  const { rawKey, serviceId } = await createTestOrgKeyAndService();
  const envId = await createTestEnvironment(serviceId, 'test');
  await createTestWallet(serviceId, envId);
  const routeId = await createTestRoute(serviceId, 'GET', '/api/weather');
  await createTestPriceRule(routeId);
  return { rawKey, serviceId };
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
});
