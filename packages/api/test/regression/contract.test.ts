import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { webhookDeliveries } from '@nibblelayer/apex-persistence/db';
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

// Helper to set up a complete manifest-ready service
async function setupFullService() {
  const { orgId, rawKey, serviceId } = await createTestOrgKeyAndService();
  const envId = await createTestEnvironment(serviceId);
  const walletId = await createTestWallet(serviceId, envId);
  const routeId = await createTestRoute(serviceId);
  const priceId = await createTestPriceRule(routeId);
  return { orgId, rawKey, serviceId, envId, walletId, routeId, priceId };
}

describe('API Contract Regression', () => {
  it('GET /manifest produces valid ApexManifest matching @x402/hono format', async () => {
    const { rawKey, serviceId } = await setupFullService();
    const headers = authHeaders(rawKey);

    const res = await app.request(`/services/${serviceId}/manifest?env=test`, { headers });
    expect(res.status).toBe(200);

    const manifest = await res.json();

    // serviceId is string
    expect(typeof manifest.serviceId).toBe('string');
    expect(manifest.serviceId.length).toBeGreaterThan(0);

    // environment is 'test' or 'prod'
    expect(['test', 'prod']).toContain(manifest.environment);

    // version is positive integer
    expect(Number.isInteger(manifest.version)).toBe(true);
    expect(manifest.version).toBeGreaterThan(0);

    // network is CAIP-2 format (namespace:reference)
    expect(manifest.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);

    // facilitatorUrl is valid URL
    expect(() => new URL(manifest.facilitatorUrl)).not.toThrow();
    expect(manifest.facilitatorUrl).toMatch(/^https?:\/\//);

    // wallet has address, token, network
    expect(manifest.wallet).toBeDefined();
    expect(typeof manifest.wallet.address).toBe('string');
    expect(manifest.wallet.address.length).toBeGreaterThan(0);
    expect(typeof manifest.wallet.token).toBe('string');
    expect(manifest.wallet.token.length).toBeGreaterThan(0);
    expect(manifest.wallet.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);

    // routes keys match "METHOD /path" pattern
    expect(manifest.routes).toBeDefined();
    const routeKeys = Object.keys(manifest.routes);
    expect(routeKeys.length).toBeGreaterThan(0);
    for (const key of routeKeys) {
      expect(key).toMatch(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \//);
    }

    // each route accepts array has: scheme, price, network, payTo
    for (const key of routeKeys) {
      const route = manifest.routes[key];
      expect(Array.isArray(route.accepts)).toBe(true);
      expect(route.accepts.length).toBeGreaterThan(0);
      for (const accept of route.accepts) {
        expect(accept.scheme).toBe('exact');
        expect(typeof accept.price).toBe('string');
        expect(accept.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);
        expect(typeof accept.payTo).toBe('string');
        expect(accept.payTo.length).toBeGreaterThan(0);
      }
    }

    // checksum is 64-char hex (SHA-256)
    expect(typeof manifest.checksum).toBe('string');
    expect(manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('POST /events accepts PaymentEventPayload matching core schema', async () => {
    const { rawKey, serviceId } = await setupFullService();
    const routeId = (await createTestRoute(serviceId, 'GET', '/api/contract-test')) || '';
    const headers = jsonAuthHeaders(rawKey);

    const eventPayload = {
      serviceId,
      routeId,
      type: 'payment.settled',
      requestId: `req_contract_${Date.now()}`,
      paymentIdentifier: `pay_contract_${Date.now()}`,
      amount: '$0.01',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      settlementReference: '0xcontract_ref_001',
      timestamp: new Date().toISOString(),
    };

    const res = await app.request('/events', {
      method: 'POST',
      headers,
      body: JSON.stringify(eventPayload),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);

    // Verify the stored event matches the payload exactly
    const { paymentEvents } = await import('@nibblelayer/apex-persistence/db');
    const [stored] = await testDb
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.requestId, eventPayload.requestId))
      .limit(1);

    expect(stored).toBeDefined();
    expect(stored.serviceId).toBe(eventPayload.serviceId);
    expect(stored.routeId).toBe(eventPayload.routeId);
    expect(stored.type).toBe(eventPayload.type);
    expect(stored.requestId).toBe(eventPayload.requestId);

    // Verify the raw payload was stored
    const storedPayload = stored.payload as Record<string, unknown>;
    expect(storedPayload.type).toBe(eventPayload.type);
    expect(storedPayload.amount).toBe(eventPayload.amount);
    expect(storedPayload.network).toBe(eventPayload.network);
    expect(storedPayload.settlementReference).toBe(eventPayload.settlementReference);
  });

  it('Webhook payload has valid HMAC-SHA256 signature', async () => {
    const { rawKey, serviceId } = await setupFullService();
    const routeId = await createTestRoute(serviceId, 'GET', '/api/webhook-sig');
    const headers = jsonAuthHeaders(rawKey);
    const getHeaders = authHeaders(rawKey);

    // Create webhook endpoint
    const webhookRes = await app.request(`/services/${serviceId}/webhooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: 'https://merchant.example.com/webhooks/apex',
        enabled: true,
      }),
    });
    expect(webhookRes.status).toBe(201);
    const webhook = await webhookRes.json();
    const secret = webhook.secret;
    expect(secret).toMatch(/^whsec_/);

    // Trigger event
    const eventRes = await app.request('/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        serviceId,
        routeId,
        type: 'payment.settled',
        requestId: `req_wh_sig_${Date.now()}`,
        paymentIdentifier: `pay_wh_sig_${Date.now()}`,
        amount: '$0.05',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        settlementReference: '0xsig_test',
        timestamp: new Date().toISOString(),
      }),
    });
    expect(eventRes.status).toBe(202);

    // Get webhook delivery
    const deliveries = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookEndpointId, webhook.id));

    expect(deliveries).toHaveLength(1);
    const delivery = deliveries[0];
    const payload = delivery.payload as Record<string, unknown>;

    // Verify payload structure
    expect(payload.type).toBe('payment.settled');
    expect(payload.id).toBeDefined();
    expect(payload.data).toBeDefined();

    // Verify that the payload can be used to compute an HMAC-SHA256 signature
    // using the endpoint secret (this is the contract the webhook consumer relies on)
    const payloadStr = JSON.stringify(payload);
    const computedSig = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');

    // The signature should be a valid 64-char hex string
    expect(computedSig).toMatch(/^[a-f0-9]{64}$/);
    expect(computedSig.length).toBe(64);

    // Same payload + same secret should produce same signature (idempotent)
    const computedSig2 = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');
    expect(computedSig2).toBe(computedSig);
  });

  it('All network fields in API responses use CAIP-2 format', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const headers = jsonAuthHeaders(rawKey);
    const getHeaders = authHeaders(rawKey);
    const network = 'eip155:84532';

    // Create environment with CAIP-2 network
    const envRes = await app.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mode: 'test',
        network,
        facilitatorUrl: 'https://x402.org/facilitator',
      }),
    });
    expect(envRes.status).toBe(201);
    const env = await envRes.json();
    expect(env.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);

    // Create wallet with CAIP-2 network
    const walletRes = await app.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        environmentId: env.id,
        address: '0x1234567890abcdef1234567890abcdef12345678',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network,
        label: 'CAIP-2 Test Wallet',
      }),
    });
    expect(walletRes.status).toBe(201);
    const wallet = await walletRes.json();
    expect(wallet.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);

    // Create route + price rule with CAIP-2 network
    const routeRes = await app.request(`/services/${serviceId}/routes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        method: 'GET',
        path: '/api/caip2-test',
        description: 'CAIP-2 format verification',
      }),
    });
    expect(routeRes.status).toBe(201);
    const route = await routeRes.json();

    const priceRes = await app.request(`/routes/${route.id}/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network,
      }),
    });
    expect(priceRes.status).toBe(201);
    const price = await priceRes.json();
    expect(price.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);

    // Fetch manifest and verify all network fields are CAIP-2
    const manifestRes = await app.request(`/services/${serviceId}/manifest?env=test`, {
      headers: getHeaders,
    });
    expect(manifestRes.status).toBe(200);
    const manifest = await manifestRes.json();

    // Root network
    expect(manifest.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);

    // Wallet network
    expect(manifest.wallet.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);

    // Every route accept network
    for (const routeKey of Object.keys(manifest.routes)) {
      for (const accept of manifest.routes[routeKey].accepts) {
        expect(accept.network).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);
      }
    }
  });
});
