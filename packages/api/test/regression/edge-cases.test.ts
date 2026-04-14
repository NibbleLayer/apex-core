import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import {
  paymentEvents,
  walletDestinations,
  routes,
  priceRules,
  discoveryMetadata,
  serviceManifests,
} from '@nibblelayer/apex-persistence/db';
import { app } from '../../src/app.js';
import { setDbResolver, resetDbResolver } from '../../src/db/resolver.js';
import { testDb } from '../setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  jsonAuthHeaders,
  authHeaders,
  createTestEnvironment,
  createTestRoute,
  createTestWallet,
  createTestPriceRule,
} from '../helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

// Helper: create a full setup (org+key+service+env+wallet+route+price)
async function fullSetup() {
  const { orgId, rawKey, serviceId } = await createTestOrgKeyAndService();
  const envId = await createTestEnvironment(serviceId);
  const walletId = await createTestWallet(serviceId, envId);
  const routeId = await createTestRoute(serviceId);
  const priceId = await createTestPriceRule(routeId);
  return { orgId, rawKey, serviceId, envId, walletId, routeId, priceId };
}

describe('Edge Case Regression', () => {
  it('Duplicate events (same request_id + type) are not stored twice', async () => {
    const { rawKey, serviceId } = await fullSetup();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/dedup-test');
    const headers = jsonAuthHeaders(rawKey);

    const payload = {
      serviceId,
      routeId,
      type: 'payment.required',
      requestId: 'req_dedup_regression',
      timestamp: new Date().toISOString(),
    };

    // Post same event twice
    const res1 = await app.request('/events', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(202);

    const res2 = await app.request('/events', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(202);

    // Verify only one record exists
    const events = await testDb
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.requestId, 'req_dedup_regression'));
    expect(events).toHaveLength(1);
  });

  it('Test and prod environments are strictly isolated', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const headers = jsonAuthHeaders(rawKey);
    const getHeaders = authHeaders(rawKey);

    // Create test env (Base Sepolia)
    const testEnvRes = await app.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode: 'test',
        network: 'eip155:84532',
        facilitatorUrl: 'https://x402.org/facilitator',
      }),
    });
    expect(testEnvRes.status).toBe(201);
    const testEnv = await testEnvRes.json();

    // Create prod env (Base Mainnet)
    const prodEnvRes = await app.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode: 'prod',
        network: 'eip155:8453',
        facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
      }),
    });
    expect(prodEnvRes.status).toBe(201);
    const prodEnv = await prodEnvRes.json();

    // Create wallet for test only
    await app.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        environmentId: testEnv.id,
        address: '0xTestOnly1234567890abcdef1234567890abcdef12',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        label: 'Test-only wallet',
      }),
    });

    // Create route + price for test
    const routeRes = await app.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method: 'GET', path: '/api/data' }),
    });
    expect(routeRes.status).toBe(201);
    const route = await routeRes.json();

    await app.request(`/routes/${route.id}/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      }),
    });

    // Prod manifest should fail (no wallet configured for prod env)
    const prodManifestRes = await app.request(`/services/${serviceId}/manifest?env=prod`, {
      headers: getHeaders,
    });
    expect(prodManifestRes.status).toBe(404);

    // Test manifest should succeed with test network
    const testManifestRes = await app.request(`/services/${serviceId}/manifest?env=test`, {
      headers: getHeaders,
    });
    expect(testManifestRes.status).toBe(200);
    const testManifest = await testManifestRes.json();
    expect(testManifest.network).toBe('eip155:84532');
    expect(testManifest.facilitatorUrl).toBe('https://x402.org/facilitator');
  });

  it('Same config produces same manifest (no version drift)', async () => {
    const { rawKey, serviceId } = await fullSetup();
    const headers = authHeaders(rawKey);

    // Generate manifest twice without changes
    const res1 = await app.request(`/services/${serviceId}/manifest?env=test`, { headers });
    expect(res1.status).toBe(200);
    const manifest1 = await res1.json();

    const res2 = await app.request(`/services/${serviceId}/manifest?env=test`, { headers });
    expect(res2.status).toBe(200);
    const manifest2 = await res2.json();

    // Same version, same checksum
    expect(manifest2.version).toBe(manifest1.version);
    expect(manifest2.checksum).toBe(manifest1.checksum);
  });

  it('Price change increments manifest version', async () => {
    const { rawKey, serviceId, routeId } = await fullSetup();
    const headers = jsonAuthHeaders(rawKey);
    const getHeaders = authHeaders(rawKey);

    // Get manifest v1
    const res1 = await app.request(`/services/${serviceId}/manifest?env=test`, { headers: getHeaders });
    expect(res1.status).toBe(200);
    const manifest1 = await res1.json();

    // Change price
    await app.request(`/routes/${routeId}/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.99',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      }),
    });

    // Get manifest again
    const res2 = await app.request(`/services/${serviceId}/manifest?env=test`, { headers: getHeaders });
    expect(res2.status).toBe(200);
    const manifest2 = await res2.json();

    // Version incremented
    expect(manifest2.version).toBeGreaterThan(manifest1.version);

    // New price is reflected
    const accepts = manifest2.routes['GET /api/test'].accepts;
    const hasNewPrice = accepts.some((a: any) => a.price === '$0.99');
    expect(hasNewPrice).toBe(true);
  });

  it('Only active wallet is used in manifest', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const headers = jsonAuthHeaders(rawKey);
    const getHeaders = authHeaders(rawKey);

    const envId = await createTestEnvironment(serviceId);

    // Create two wallets, first active, second inactive
    await testDb.insert(walletDestinations).values([
      {
        id: 'w_active_001',
        serviceId,
        environmentId: envId,
        address: '0xActive0000000000000000000000000000000001',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        label: 'Active wallet',
        active: true,
      },
      {
        id: 'w_inactive_001',
        serviceId,
        environmentId: envId,
        address: '0xInactive00000000000000000000000000000002',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        label: 'Inactive wallet',
        active: false,
      },
    ]);

    // Create route + price
    const routeId = await createTestRoute(serviceId);
    await createTestPriceRule(routeId);

    // Generate manifest
    const res = await app.request(`/services/${serviceId}/manifest?env=test`, { headers: getHeaders });
    expect(res.status).toBe(200);
    const manifest = await res.json();

    // Manifest uses the active wallet
    expect(manifest.wallet.address).toBe('0xActive0000000000000000000000000000000001');
    expect(manifest.wallet.address).not.toBe('0xInactive00000000000000000000000000000002');
  });

  it('Disabled routes excluded from manifest', async () => {
    const { rawKey, serviceId, envId } = await (async () => {
      const { rawKey, serviceId } = await createTestOrgKeyAndService();
      const envId = await createTestEnvironment(serviceId);
      await createTestWallet(serviceId, envId);
      return { rawKey, serviceId, envId };
    })();
    const headers = jsonAuthHeaders(rawKey);
    const getHeaders = authHeaders(rawKey);

    // Create two routes: one enabled, one disabled
    const enabledRouteId = await createTestRoute(serviceId, 'GET', '/api/enabled');
    await createTestPriceRule(enabledRouteId);

    const disabledRouteId = await createTestRoute(serviceId, 'GET', '/api/disabled');
    await createTestPriceRule(disabledRouteId);

    // Disable the second route
    await app.request(`/routes/${disabledRouteId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ enabled: false }),
    });

    // Generate manifest
    const res = await app.request(`/services/${serviceId}/manifest?env=test`, { headers: getHeaders });
    expect(res.status).toBe(200);
    const manifest = await res.json();

    // Only enabled route appears
    expect(manifest.routes['GET /api/enabled']).toBeDefined();
    expect(manifest.routes['GET /api/disabled']).toBeUndefined();
  });

  it('Inactive price rules excluded from manifest', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    await createTestWallet(serviceId, envId);
    const routeId = await createTestRoute(serviceId);

    // Create price rule, then deactivate it
    const priceId = await createTestPriceRule(routeId, '$0.05');

    // Deactivate the price rule
    await testDb
      .update(priceRules)
      .set({ active: false })
      .where(eq(priceRules.id, priceId));

    const getHeaders = authHeaders(rawKey);

    // Generate manifest
    const res = await app.request(`/services/${serviceId}/manifest?env=test`, { headers: getHeaders });

    // Manifest generation will fail since no active price rules exist
    // OR it succeeds but with no routes (route with no accepts is excluded)
    if (res.status === 200) {
      const manifest = await res.json();
      // Route should not appear since it has no active price rules
      expect(manifest.routes['GET /api/test']).toBeUndefined();
    } else {
      // If it returns 404 (no routes with pricing), that's also valid isolation
      expect(res.status).toBe(404);
    }
  });

  it('Discovery metadata excluded from manifest when unpublished', async () => {
    const { rawKey, serviceId } = await fullSetup();
    const headers = jsonAuthHeaders(rawKey);
    const getHeaders = authHeaders(rawKey);

    // Get route ID from manifest (already has one)
    const { routeId } = await (async () => {
      const r = await testDb.select().from(routes).where(eq(routes.serviceId, serviceId)).limit(1);
      return { routeId: r[0].id };
    })();

    // Create discovery with discoverable=true but published=false (default)
    const discRes = await app.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        discoverable: true,
        category: 'weather',
        tags: ['forecast'],
        description: 'Weather data',
        mimeType: 'application/json',
      }),
    });
    expect(discRes.status).toBe(201);

    // Fetch manifest — bazaar extension NOT present
    const manifestRes1 = await app.request(`/services/${serviceId}/manifest?env=test`, {
      headers: getHeaders,
    });
    expect(manifestRes1.status).toBe(200);
    const manifest1 = await manifestRes1.json();
    const routeKey = Object.keys(manifest1.routes)[0];
    expect(manifest1.routes[routeKey].extensions?.bazaar).toBeUndefined();

    // Now publish
    await app.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        discoverable: true,
        category: 'weather',
        tags: ['forecast'],
        published: true,
      }),
    });

    // Fetch manifest — bazaar extension present
    const manifestRes2 = await app.request(`/services/${serviceId}/manifest?env=test`, {
      headers: getHeaders,
    });
    expect(manifestRes2.status).toBe(200);
    const manifest2 = await manifestRes2.json();
    expect(manifest2.routes[routeKey].extensions?.bazaar).toBeDefined();
    expect(manifest2.routes[routeKey].extensions?.bazaar?.discoverable).toBe(true);
    expect(manifest2.routes[routeKey].extensions?.bazaar?.category).toBe('weather');
  });

  it('API key from org A cannot access org B resources', async () => {
    // Create org A with full setup
    const orgA = await fullSetup();

    // Create org B with its own setup
    const orgB = await fullSetup();

    // Try to access org B service with org A key
    const res = await app.request(`/services/${orgB.serviceId}`, {
      headers: authHeaders(orgA.rawKey),
    });
    expect(res.status).toBe(404);

    // Try to read org B manifest with org A key
    const manifestRes = await app.request(`/services/${orgB.serviceId}/manifest?env=test`, {
      headers: authHeaders(orgA.rawKey),
    });
    expect(manifestRes.status).toBe(404);

    // Verify org A CAN access its own service
    const selfRes = await app.request(`/services/${orgA.serviceId}`, {
      headers: authHeaders(orgA.rawKey),
    });
    expect(selfRes.status).toBe(200);
  });
});
