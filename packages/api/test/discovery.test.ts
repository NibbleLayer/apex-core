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
    expect(body.reviewStatus).toBe('draft');
    expect(body.indexingStatus).toBe('not_submitted');
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

  it('rejects publishing incomplete metadata with actionable quality errors', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/incomplete');

    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: false,
        reviewStatus: 'published',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not ready/i);
    expect(body.qualityChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 'error', message: 'Description is required before publishing.' }),
        expect.objectContaining({ level: 'error', message: 'Route must be discoverable before publishing.' }),
      ]),
    );
  });

  it('publishes complete metadata and queues indexing', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/publishable');

    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: true,
        category: 'weather',
        tags: ['forecast'],
        description: 'Detailed weather forecast endpoint for Bazaar publication',
        mimeType: 'application/json',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        docsUrl: 'https://docs.example.com/weather',
        reviewStatus: 'published',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.reviewStatus).toBe('published');
    expect(body.published).toBe(true);
    expect(body.indexingStatus).toBe('queued');
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

describe('GET /routes/:id/discovery/preview', () => {
  it('returns listing preview and quality checks', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/preview');

    await discoveryRoutes.request(`/routes/${routeId}/discovery`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        discoverable: true,
        category: 'weather',
        description: 'Detailed weather forecast endpoint for preview',
        mimeType: 'application/json',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
      }),
    });

    const res = await discoveryRoutes.request(`/routes/${routeId}/discovery/preview`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview).toMatchObject({ method: 'GET', path: '/api/preview', category: 'weather' });
    expect(Array.isArray(body.qualityChecks)).toBe(true);
  });
});
