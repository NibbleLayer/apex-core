import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pricingRoutes } from '../src/routes/pricing.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  jsonAuthHeaders,
  authHeaders,
  createTestOrg,
  createTestApiKey,
  createTestService,
  createTestEnvironment,
  createTestRoute,
} from './helpers.js';
import { routes } from '@nibblelayer/apex-persistence/db';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('POST /routes/:routeId/pricing', () => {
  it('creates a price rule for a route', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/weather');
    // Need environment + wallet for manifest generation
    const envId = await createTestEnvironment(serviceId);
    const { walletDestinations } = await import('@nibblelayer/apex-persistence/db');
    await testDb.insert(walletDestinations).values({
      id: 'c_testwallet000000000000001',
      serviceId,
      environmentId: envId,
      address: '0x1234567890abcdef1234567890abcdef12345678',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      label: 'Test',
      active: true,
    });

    const res = await pricingRoutes.request(`/routes/${routeId}/pricing`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.routeId).toBe(routeId);
    expect(body.scheme).toBe('exact');
    expect(body.amount).toBe('$0.01');
    expect(body.network).toBe('eip155:84532');
    expect(body.active).toBe(true);
    expect(body.id).toBeDefined();
  });

  it('rejects invalid scheme', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);

    const res = await pricingRoutes.request(`/routes/${routeId}/pricing`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        scheme: 'subscription',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects invalid CAIP-2 network', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);

    const res = await pricingRoutes.request(`/routes/${routeId}/pricing`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'invalid-network',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent route', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await pricingRoutes.request('/routes/c_nonexistent/pricing', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await pricingRoutes.request('/routes/fake/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /routes/:routeId/pricing', () => {
  it('returns all price rules for a route', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/prices');

    // Create price rules directly in DB
    const { priceRules } = await import('@nibblelayer/apex-persistence/db');
    const { createId } = await import('../src/utils/id.js');
    await testDb.insert(priceRules).values([
      {
        id: createId(),
        routeId,
        scheme: 'exact',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        active: true,
      },
      {
        id: createId(),
        routeId,
        scheme: 'exact',
        amount: '$0.05',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        active: true,
      },
    ]);

    const res = await pricingRoutes.request(`/routes/${routeId}/pricing`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('returns empty array for route with no pricing', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/empty');

    const res = await pricingRoutes.request(`/routes/${routeId}/pricing`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
