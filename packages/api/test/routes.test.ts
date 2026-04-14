import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { routeRoutes } from '../src/routes/routes.js';
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
} from './helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('POST /services/:serviceId/routes', () => {
  it('creates a route for a service', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        method: 'GET',
        path: '/weather',
        description: 'Get weather data',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.serviceId).toBe(serviceId);
    expect(body.method).toBe('GET');
    expect(body.path).toBe('/weather');
    expect(body.description).toBe('Get weather data');
    expect(body.enabled).toBe(true);
    expect(body.id).toBeDefined();
  });

  it('creates a route with enabled=false', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        method: 'POST',
        path: '/data',
        enabled: false,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.description).toBeNull();
  });

  it('rejects duplicate method+path for the same service', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    // Create first route
    await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        method: 'GET',
        path: '/duplicate',
      }),
    });

    // Try to create same route again
    const res = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        method: 'GET',
        path: '/duplicate',
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already exists');
  });

  it('allows same path with different method', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res1 = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ method: 'GET', path: '/resource' }),
    });
    expect(res1.status).toBe(201);

    const res2 = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ method: 'POST', path: '/resource' }),
    });
    expect(res2.status).toBe(201);
  });

  it('rejects invalid input (path without leading slash)', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        method: 'GET',
        path: 'no-leading-slash',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects invalid method', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        method: 'INVALID',
        path: '/test',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await routeRoutes.request('/services/c_nonexistent_service/routes', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ method: 'GET', path: '/test' }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await routeRoutes.request('/services/fake/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'GET', path: '/test' }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /services/:serviceId/routes', () => {
  it('returns routes for a service', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    // Create several routes
    await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ method: 'GET', path: '/weather' }),
    });
    await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ method: 'POST', path: '/weather' }),
    });

    const res = await routeRoutes.request(`/services/${serviceId}/routes`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('returns empty array for service with no routes', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await routeRoutes.request(`/services/${serviceId}/routes`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await routeRoutes.request('/services/c_nonexistent/routes', {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /routes/:id', () => {
  it('updates route enabled status', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const createRes = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ method: 'GET', path: '/toggle', description: 'Original' }),
    });
    const created = await createRes.json();

    const res = await routeRoutes.request(`/routes/${created.id}`, {
      method: 'PATCH',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.description).toBe('Original'); // unchanged
  });

  it('updates route description', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const createRes = await routeRoutes.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ method: 'GET', path: '/desc-update' }),
    });
    const created = await createRes.json();

    const res = await routeRoutes.request(`/routes/${created.id}`, {
      method: 'PATCH',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ description: 'Updated description' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.description).toBe('Updated description');
  });

  it('returns 404 for non-existent route', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await routeRoutes.request('/routes/c_nonexistent_route_id', {
      method: 'PATCH',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 when route belongs to another org', async () => {
    // Create route under org A
    const { serviceId: serviceIdA } = await createTestOrgKeyAndService('Service A');
    const { rawKey: rawKeyA } = await createTestOrgWithKey('Key A');
    // Actually need the same org's key. Let me restructure: create org A with a route,
    // then try to patch it with org B's key.

    // Org A
    const orgIdA = await createTestOrg();
    const { rawKey: keyA } = await createTestApiKey(orgIdA, 'OrgA Key');
    const svcIdA = await createTestService(orgIdA, 'Svc A');

    // Create route under org A
    const createRes = await routeRoutes.request(`/services/${svcIdA}/routes`, {
      method: 'POST',
      headers: jsonAuthHeaders(keyA),
      body: JSON.stringify({ method: 'GET', path: '/protected' }),
    });
    const created = await createRes.json();

    // Org B
    const { rawKey: keyB } = await createTestOrgWithKey('OrgB Key');

    // Try to patch org A's route with org B's key
    const res = await routeRoutes.request(`/routes/${created.id}`, {
      method: 'PATCH',
      headers: jsonAuthHeaders(keyB),
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404); // Returns 404 to prevent enumeration
  });
});
