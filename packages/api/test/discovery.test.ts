import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { discoveryRoutes } from '../src/routes/discovery.js';
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
} from './helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('POST /routes/:id/discovery', () => {
  it('creates discovery metadata for a route', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    await createTestWallet(serviceId, envId);
    const routeId = await createTestRoute(serviceId, 'GET', '/api/weather');

    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: true,
        category: 'weather',
        tags: ['forecast', 'real-time'],
        description: 'Current weather data',
        mimeType: 'application/json',
        inputSchema: { queryParams: { location: { type: 'string', required: true } } },
        outputSchema: { type: 'object', properties: { temperature: { type: 'number' } } },
        docsUrl: 'https://docs.example.com/weather',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.routeId).toBe(routeId);
    expect(body.discoverable).toBe(true);
    expect(body.category).toBe('weather');
    expect(body.tags).toEqual(['forecast', 'real-time']);
    expect(body.description).toBe('Current weather data');
    expect(body.published).toBe(false);
  });

  it('updates existing discovery metadata', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    await createTestWallet(serviceId, envId);
    const routeId = await createTestRoute(serviceId, 'GET', '/api/update');

    // Create first
    await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: false,
        category: 'test',
      }),
    });

    // Update
    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: true,
        category: 'updated-category',
        tags: ['new'],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discoverable).toBe(true);
    expect(body.category).toBe('updated-category');
    expect(body.tags).toEqual(['new']);
  });

  it('rejects invalid input', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);

    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: 'not-a-boolean',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent route', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await discoveryRoutes.request('/routes/c_nonexistent/discovery', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ discoverable: true }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await discoveryRoutes.request('/routes/fake/discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discoverable: true }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /routes/:id/discovery', () => {
  it('returns discovery metadata for a route', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    await createTestWallet(serviceId, envId);
    const routeId = await createTestRoute(serviceId, 'GET', '/api/getdisc');

    // Create discovery metadata
    await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: true,
        category: 'test',
      }),
    });

    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discoverable).toBe(true);
    expect(body.category).toBe('test');
  });

  it('returns 404 when no discovery metadata exists', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/nodisc');

    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(404);
  });
});
