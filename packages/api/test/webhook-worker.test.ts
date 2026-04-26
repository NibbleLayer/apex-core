import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { eq } from 'drizzle-orm';
import { webhookDeliveries, webhookEndpoints } from '@nibblelayer/apex-persistence/db';
import { testDb } from './setup.js';
import { createId } from '../src/utils/id.js';
import { processWebhookDeliveries } from '../src/workers/webhook.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { verifyWebhookSignature } from '../src/services/webhook-signing.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

/**
 * Create a mock HTTP server that captures incoming webhook requests.
 * Returns the captured requests and a close function.
 */
function createMockWebhookServer(
  port: number,
  handler?: (req: IncomingMessage, res: ServerResponse, body: string) => void,
): Promise<{ received: any[]; close: () => void }> {
  return new Promise((resolve) => {
    const received: any[] = [];
    const server: Server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk));
      req.on('end', () => {
        received.push({
          method: req.method,
          headers: req.headers,
          body: JSON.parse(body),
        });
        if (handler) {
          handler(req, res, body);
        } else {
          res.writeHead(200);
          res.end('ok');
        }
      });
    });
    server.listen(port, () => resolve({ received, close: () => server.close() }));
  });
}

/**
 * Helper to create a full test setup with an endpoint and delivery record.
 */
async function createDeliverySetup(
  targetUrl: string,
  enabled = true,
  payload: Record<string, unknown> = { type: 'payment.settled', data: { amount: '$0.01' } },
) {
  // Create org + service + route + payment event (minimal)
  const orgId = await (async () => {
    const id = createId();
    const now = new Date();
    const { organizations } = await import('@nibblelayer/apex-persistence/db');
    await testDb.insert(organizations).values({
      id,
      name: 'Test Org',
      slug: `wh-worker-org-${id.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  })();

  const serviceId = await (async () => {
    const id = createId();
    const now = new Date();
    const { services } = await import('@nibblelayer/apex-persistence/db');
    await testDb.insert(services).values({
      id,
      organizationId: orgId,
      name: 'Test Service',
      slug: `wh-worker-svc-${id.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  })();

  const routeId = await (async () => {
    const id = createId();
    const { routes } = await import('@nibblelayer/apex-persistence/db');
    await testDb.insert(routes).values({
      id,
      serviceId,
      method: 'GET',
      path: '/api/test',
      description: 'Test route',
      enabled: true,
    });
    return id;
  })();

  const eventId = await (async () => {
    const id = createId();
    const { paymentEvents } = await import('@nibblelayer/apex-persistence/db');
    await testDb.insert(paymentEvents).values({
      id,
      serviceId,
      routeId,
      type: 'payment.settled',
      requestId: `req_wh_test_${id.slice(0, 8)}`,
      paymentIdentifier: null,
      buyerAddress: null,
      payload: null,
    });
    return id;
  })();

  // Create webhook endpoint
  const endpointId = createId();
  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date();
  await testDb.insert(webhookEndpoints).values({
    id: endpointId,
    serviceId,
    url: targetUrl,
    secret,
    enabled,
    createdAt: now,
    updatedAt: now,
  });

  // Create webhook delivery
  const deliveryId = createId();
  await testDb.insert(webhookDeliveries).values({
    id: deliveryId,
    webhookEndpointId: endpointId,
    eventId,
    payload,
    status: 'pending',
    attempts: 0,
  });

  return { deliveryId, endpointId, secret, eventId, serviceId };
}

describe('Webhook Worker', () => {
  it('delivers pending webhook to a running server', async () => {
    const mock = await createMockWebhookServer(0); // random port
    const addr = (mock as any).received; // server is listening
    // Get the actual port from the server
    const serverAddr = await new Promise<{ port: number }>((resolve) => {
      const s = createServer(() => {});
      s.listen(0, () => {
        const addr = s.address() as any;
        s.close(() => resolve({ port: addr.port }));
      });
    });

    // Use a fixed port for the mock server
    await mock.close();
    const mockPort = serverAddr.port;

    // Create a new mock server on this port
    const mockServer = await new Promise<{ received: any[]; close: () => void }>((resolve) => {
      const received: any[] = [];
      const server = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk));
        req.on('end', () => {
          received.push({
            method: req.method,
            headers: req.headers,
            body: JSON.parse(body),
          });
          res.writeHead(200);
          res.end('ok');
        });
      });
      server.listen(mockPort, () => resolve({ received, close: () => server.close() }));
    });

    const payload = { type: 'payment.settled', data: { amount: '$0.01' } };
    const { deliveryId, secret } = await createDeliverySetup(
      `http://127.0.0.1:${mockPort}/webhook`,
      true,
      payload,
    );

    const count = await processWebhookDeliveries();
    expect(count).toBe(1);

    // Verify delivery was marked as delivered
    const [delivery] = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    expect(delivery.status).toBe('delivered');
    expect(delivery.attempts).toBe(1);

    // Verify the mock server received the correct data
    expect(mockServer.received).toHaveLength(1);
    const req = mockServer.received[0];
    expect(req.method).toBe('POST');

    // Verify replay-resistant HMAC signature against timestamp.deliveryId.body.
    const actualBody = JSON.stringify(req.body);
    expect(verifyWebhookSignature({
      secret,
      timestamp: String(req.headers['x-apex-timestamp']),
      deliveryId,
      body: actualBody,
      signature: String(req.headers['x-apex-signature']),
      toleranceSeconds: 300,
    })).toBe(true);
    expect(req.headers['x-apex-event-type']).toBe('payment.settled');
    expect(req.headers['x-apex-delivery-id']).toBe(deliveryId);
    expect(req.headers['x-apex-timestamp']).toMatch(/^\d+$/);
    expect(req.body.type).toBe('payment.settled');
    expect(req.body.data).toEqual({ amount: '$0.01' });

    await mockServer.close();
  });

  it('increments attempts and keeps pending on failure', async () => {
    const { deliveryId } = await createDeliverySetup(
      'http://127.0.0.1:1/fail', // Connection refused
      true,
      { type: 'payment.failed', data: {} },
    );

    const count = await processWebhookDeliveries();
    expect(count).toBe(0);

    const [delivery] = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    expect(delivery.attempts).toBe(1);
    expect(delivery.status).toBe('pending');
    expect(delivery.nextAttemptAt).toBeInstanceOf(Date);
    expect(delivery.lastError).toBeDefined();
  });

  it('dead-letters after 5 failed attempts', async () => {
    const { deliveryId } = await createDeliverySetup(
      'http://127.0.0.1:1/dead',
      true,
      { type: 'payment.failed', data: {} },
    );

    // Set attempts to 4 (one more attempt will exceed MAX_ATTEMPTS)
    await testDb
      .update(webhookDeliveries)
      .set({ attempts: 4 })
      .where(eq(webhookDeliveries.id, deliveryId));

    await processWebhookDeliveries();

    const [delivery] = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    expect(delivery.attempts).toBe(5);
    expect(delivery.status).toBe('dead_lettered');
    expect(delivery.nextAttemptAt).toBeNull();
  });

  it('skips pending deliveries until nextAttemptAt is due', async () => {
    const { deliveryId } = await createDeliverySetup(
      'http://127.0.0.1:1/not-yet',
      true,
      { type: 'payment.failed', data: {} },
    );

    await testDb
      .update(webhookDeliveries)
      .set({ nextAttemptAt: new Date(Date.now() + 60_000) })
      .where(eq(webhookDeliveries.id, deliveryId));

    await processWebhookDeliveries();

    const [delivery] = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    expect(delivery.attempts).toBe(0);
    expect(delivery.status).toBe('pending');
  });

  it('dead-letters deliveries with attempts >= MAX_ATTEMPTS on fetch', async () => {
    const { deliveryId } = await createDeliverySetup(
      'http://127.0.0.1:1/already',
      true,
      { type: 'payment.failed', data: {} },
    );

    // Manually set attempts to MAX_ATTEMPTS, keep status pending
    await testDb
      .update(webhookDeliveries)
      .set({ attempts: 5 })
      .where(eq(webhookDeliveries.id, deliveryId));

    await processWebhookDeliveries();

    const [delivery] = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    expect(delivery.status).toBe('dead_lettered');
  });

  it('skips delivery when endpoint is disabled', async () => {
    const { deliveryId } = await createDeliverySetup(
      'http://127.0.0.1:1/disabled',
      false,
      { type: 'payment.required', data: {} },
    );

    await processWebhookDeliveries();

    const [delivery] = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, deliveryId));
    expect(delivery.status).toBe('dead_lettered');
  });
});
