import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eventRoutes } from '../src/routes/events.js';
import { webhookRoutes } from '../src/routes/webhooks.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  jsonAuthHeaders,
  authHeaders,
  createTestEnvironment,
  createTestRoute,
} from './helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('POST /events', () => {
  it('accepts a valid payment event and returns 202', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    const routeId = await createTestRoute(serviceId);

    const res = await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        serviceId,
        routeId,
        type: 'payment.required',
        requestId: 'req_001',
        timestamp: new Date().toISOString(),
      }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
  });

  it('returns 400 for invalid payload', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        serviceId: '',
        type: 'invalid.type',
        requestId: '',
        timestamp: 'not-a-date',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('deduplicates events with same request_id and type', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    const routeId = await createTestRoute(serviceId);

    const payload = {
      serviceId,
      routeId,
      type: 'payment.verified',
      requestId: 'req_dedup_001',
      timestamp: new Date().toISOString(),
    };

    // First request
    const res1 = await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(202);

    // Duplicate request
    const res2 = await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(202);

    // Verify only one event was stored
    const { paymentEvents } = await import('@nibblelayer/apex-persistence/db');
    const events = await testDb
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.requestId, 'req_dedup_001'));
    expect(events).toHaveLength(1);
  });

  it('creates settlement record on payment.settled event', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    const routeId = await createTestRoute(serviceId);

    const res = await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        serviceId,
        routeId,
        type: 'payment.settled',
        requestId: 'req_settled_001',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        settlementReference: '0xabc123',
        timestamp: new Date().toISOString(),
      }),
    });

    expect(res.status).toBe(202);

    // Verify settlement was created
    const { settlements } = await import('@nibblelayer/apex-persistence/db');
    const result = await testDb
      .select()
      .from(settlements)
      .where(eq(settlements.serviceId, serviceId));

    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe('$0.01');
    expect(result[0].settlementReference).toBe('0xabc123');
    expect(result[0].status).toBe('confirmed');
  });

  it('returns 401 without authentication', async () => {
    const res = await eventRoutes.request('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: 'fake',
        type: 'payment.required',
        requestId: 'req_001',
        timestamp: new Date().toISOString(),
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 404 for service not owned by authenticated org', async () => {
    const { rawKey } = await createTestOrgWithKey();
    // Create a different org with a service
    const { serviceId: otherServiceId } = await createTestOrgKeyAndService('Other Service');

    const res = await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        serviceId: otherServiceId,
        routeId: 'fake',
        type: 'payment.required',
        requestId: 'req_002',
        timestamp: new Date().toISOString(),
      }),
    });

    expect(res.status).toBe(404);
  });
});

describe('GET /services/:id/events', () => {
  it('returns paginated events', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);

    // Create some events directly
    const { paymentEvents } = await import('@nibblelayer/apex-persistence/db');
    const { createId } = await import('../src/utils/id.js');
    for (let i = 0; i < 3; i++) {
      await testDb.insert(paymentEvents).values({
        id: createId(),
        serviceId,
        routeId,
        type: 'payment.required',
        requestId: `req_page_${i}`,
        paymentIdentifier: null,
        buyerAddress: null,
        payload: null,
      });
    }

    const res = await eventRoutes.request(`/services/${serviceId}/events?limit=2&offset=0`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(2);
    expect(body.total).toBe(3);
  });

  it('filters events by type', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);

    const { paymentEvents } = await import('@nibblelayer/apex-persistence/db');
    const { createId } = await import('../src/utils/id.js');
    await testDb.insert(paymentEvents).values([
      {
        id: createId(),
        serviceId,
        routeId,
        type: 'payment.required',
        requestId: 'req_filter_1',
        paymentIdentifier: null,
        buyerAddress: null,
        payload: null,
      },
      {
        id: createId(),
        serviceId,
        routeId,
        type: 'payment.settled',
        requestId: 'req_filter_2',
        paymentIdentifier: null,
        buyerAddress: null,
        payload: null,
      },
    ]);

    const res = await eventRoutes.request(`/services/${serviceId}/events?type=payment.settled`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].type).toBe('payment.settled');
    expect(body.total).toBe(1);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await eventRoutes.request('/services/c_nonexistent/events', {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(404);
  });
});

describe('Webhook delivery enqueue on event ingestion', () => {
  it('creates webhook_deliveries for each enabled endpoint', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    const routeId = await createTestRoute(serviceId);

    // Create two webhook endpoints
    await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://a.example.com/hook', enabled: true }),
    });
    await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://b.example.com/hook', enabled: true }),
    });

    // Ingest event
    const res = await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        serviceId,
        routeId,
        type: 'payment.required',
        requestId: 'req_wh_enqueue_1',
        timestamp: new Date().toISOString(),
      }),
    });

    expect(res.status).toBe(202);

    // Verify webhook_deliveries were created
    const { webhookDeliveries } = await import('@nibblelayer/apex-persistence/db');
    const deliveries = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, 'pending'));

    expect(deliveries).toHaveLength(2);
    for (const d of deliveries) {
      expect(d.attempts).toBe(0);
      expect(d.payload).toBeDefined();
      expect((d.payload as any).type).toBe('payment.required');
    }
  });

  it('skips disabled endpoints', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    const routeId = await createTestRoute(serviceId);

    // Create one enabled and one disabled endpoint
    await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://enabled.example.com/hook', enabled: true }),
    });
    await webhookRoutes.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({ url: 'https://disabled.example.com/hook', enabled: false }),
    });

    // Ingest event
    await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        serviceId,
        routeId,
        type: 'payment.required',
        requestId: 'req_wh_skip_1',
        timestamp: new Date().toISOString(),
      }),
    });

    // Only 1 delivery (enabled endpoint only)
    const { webhookDeliveries } = await import('@nibblelayer/apex-persistence/db');
    const deliveries = await testDb.select().from(webhookDeliveries);
    expect(deliveries).toHaveLength(1);
  });

  it('creates zero deliveries when no endpoints exist', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);
    const routeId = await createTestRoute(serviceId);

    await eventRoutes.request('/events', {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        serviceId,
        routeId,
        type: 'payment.required',
        requestId: 'req_wh_none_1',
        timestamp: new Date().toISOString(),
      }),
    });

    const { webhookDeliveries } = await import('@nibblelayer/apex-persistence/db');
    const deliveries = await testDb.select().from(webhookDeliveries);
    expect(deliveries).toHaveLength(0);
  });
});

// Import eq for queries
import { eq } from 'drizzle-orm';
