import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { manifestRoutes } from '../src/routes/manifests.js';
import { resetDbResolver, setDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  authHeaders,
  createTestEnvironment,
  createTestOrgKeyAndService,
  createTestPriceRule,
  createTestRoute,
  createTestWallet,
} from './helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

async function setupManifestReadyService() {
  const { rawKey, serviceId } = await createTestOrgKeyAndService('Manifest Alignment Service');
  const environmentId = await createTestEnvironment(serviceId, 'test');
  await createTestWallet(serviceId, environmentId);
  const routeId = await createTestRoute(serviceId, 'GET', '/api/alignment');
  await createTestPriceRule(routeId);
  return { rawKey, serviceId };
}

describe('manifest alignment', () => {
  it('returns runtime-facing camelCase manifest fields for manifest consumers', async () => {
    const { rawKey, serviceId } = await setupManifestReadyService();

    const response = await manifestRoutes.request(`/services/${serviceId}/manifest?env=test`, {
      headers: authHeaders(rawKey),
    });

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        serviceId,
        facilitatorUrl: expect.any(String),
        eventsEndpoint: '/events',
        idempotencyEnabled: expect.any(Boolean),
        refreshIntervalMs: expect.any(Number),
      }),
    );

    expect(body).not.toHaveProperty('service_id');
    expect(body).not.toHaveProperty('facilitator_url');
    expect(body).not.toHaveProperty('events_endpoint');
    expect(body).not.toHaveProperty('idempotency_enabled');
    expect(body).not.toHaveProperty('refresh_interval_ms');
  });
});
