import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { webhookRoutes } from '../src/routes/webhooks.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  jsonAuthHeaders,
  authHeaders,
  createTestRoute,
} from './helpers.js';
import { paymentEvents, webhookDeliveries } from '@nibblelayer/apex-persistence/db';
import { createId } from '../src/utils/id.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('POST /services/:id/webhooks', () => {
  it('creates a webhook and returns secret', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        url: 'https://my-app.com/webhooks/apex',
        enabled: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.serviceId).toBe(serviceId);
    expect(body.url).toBe('https://my-app.com/webhooks/apex');
    expect(body.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(body.enabled).toBe(true);
  });

  it('creates a webhook with enabled defaulting to true', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        url: 'https://my-app.com/webhooks/default',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.enabled).toBe(true);
  });

  it('rejects invalid URL', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        url: 'not-a-url',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await webhookRoutes.request('/services/c_nonexistent/webhooks', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await webhookRoutes.request('/services/fake/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /services/:id/webhooks', () => {
  it('returns webhooks WITHOUT secrets', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    // Create a webhook first
    await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        url: 'https://my-app.com/webhooks/apex',
        enabled: true,
      }),
    });

    const res = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].url).toBe('https://my-app.com/webhooks/apex');
    expect(body[0].secret).toBeUndefined();
    expect(body[0].id).toBeDefined();
  });

  it('returns empty array when no webhooks', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});

describe('GET /services/:id/webhook-deliveries', () => {
  it('returns recent webhook delivery failures with endpoint visibility', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);

    const createRes = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    });
    const webhook = await createRes.json();

    const eventId = createId();
    await testDb.insert(paymentEvents).values({
      id: eventId,
      serviceId,
      routeId,
      type: 'payment.failed',
      requestId: 'req_delivery_list',
      paymentIdentifier: 'pay_delivery_list',
      buyerAddress: null,
      payload: null,
    });

    await testDb.insert(webhookDeliveries).values({
      id: createId(),
      webhookEndpointId: webhook.id,
      eventId,
      payload: { type: 'payment.failed' },
      status: 'pending',
      attempts: 1,
      lastAttemptAt: new Date(),
      nextAttemptAt: new Date(),
      lastError: 'HTTP 500',
    });

    const res = await webhookRoutes.request(`/services/${serviceId}/webhook-deliveries?status=pending`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deliveries).toHaveLength(1);
    expect(body.deliveries[0]).toMatchObject({
      endpointUrl: 'https://example.com/hook',
      status: 'pending',
      attempts: 1,
      lastError: 'HTTP 500',
      eventId,
    });
  });
});

describe('PATCH /webhooks/:id', () => {
  it('updates webhook URL', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const createRes = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://old.example.com/hook' }),
    });
    const created = await createRes.json();

    const res = await webhookRoutes.request(`/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://new.example.com/hook' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://new.example.com/hook');
    // Secret should not be in response
    expect(body.secret).toBeUndefined();
  });

  it('updates webhook enabled status', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const createRes = await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://example.com/hook' }),
    });
    const created = await createRes.json();

    const res = await webhookRoutes.request(`/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
  });

  it('returns 404 for non-existent webhook', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await webhookRoutes.request('/webhooks/c_nonexistent', {
      method: 'PATCH',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 when webhook belongs to another org', async () => {
    // Org A creates webhook
    const { rawKey: keyA, serviceId: svcA } = await createTestOrgKeyAndService();
    const createRes = await webhookRoutes.request(`/services/${svcA}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(keyA),
      body: JSON.stringify({ url: 'https://a.example.com/hook' }),
    });
    const created = await createRes.json();

    // Org B tries to update
    const { rawKey: keyB } = await createTestOrgWithKey('Org B');
    const res = await webhookRoutes.request(`/webhooks/${created.id}`, {
      method: 'PATCH',
      headers: jsonAuthHeaders(keyB),
      body: JSON.stringify({ enabled: false }),
    });

    expect(res.status).toBe(404);
  });
});
