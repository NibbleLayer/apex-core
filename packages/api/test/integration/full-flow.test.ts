import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { webhookDeliveries } from '@nibblelayer/apex-persistence/db';
import { app } from '../../src/app.js';
import { setDbResolver, resetDbResolver } from '../../src/db/resolver.js';
import { testDb } from '../setup.js';
import { jsonAuthHeaders, authHeaders } from '../helpers.js';

const BOOTSTRAP_TOGGLE = 'ALLOW_UNAUTHENTICATED_ORGANIZATION_BOOTSTRAP';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('Full Flow Integration', () => {
  it('covers the complete seller journey end-to-end', async () => {
    process.env[BOOTSTRAP_TOGGLE] = 'true';

    try {
      // 1. Create organization
      const orgRes = await app.request('/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Weather Corp', slug: 'weather-corp' }),
      });
      expect(orgRes.status).toBe(201);
      const org = await orgRes.json();

      // Create API key directly in DB (auth routes are separate)
      const crypto = await import('node:crypto');
      const { hashApiKey } = await import('../../src/crypto.js');
      const { apiKeys } = await import('@nibblelayer/apex-persistence/db');
      const rawKey = `apex_${crypto.randomBytes(32).toString('hex')}`;
      const keyHash = await hashApiKey(rawKey);
      const keyPrefix = rawKey.slice(0, 8);
      const { createId } = await import('../../src/utils/id.js');
      const keyId = createId();
      await testDb.insert(apiKeys).values({
        id: keyId,
        organizationId: org.id,
        keyHash,
        keyPrefix,
        label: 'Integration Test Key',
        createdAt: new Date(),
        revokedAt: null,
        lastUsedAt: null,
      });
      const headers = jsonAuthHeaders(rawKey);
      const getHeaders = authHeaders(rawKey);

      // 2. Create service
      const svcRes = await app.request('/services', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Weather API', slug: 'weather-api', description: 'Weather data service' }),
      });
      expect(svcRes.status).toBe(201);
      const svc = await svcRes.json();

      // 3. Create test environment (Base Sepolia)
      const envRes = await app.request(`/services/${svc.id}/environments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode: 'test', network: 'eip155:84532', facilitatorUrl: 'https://x402.org/facilitator' }),
      });
      expect(envRes.status).toBe(201);
      const env = await envRes.json();
      expect(env.mode).toBe('test');
      expect(env.network).toBe('eip155:84532');

      // 4. Add wallet destination
      const walletRes = await app.request(`/services/${svc.id}/wallets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          environmentId: env.id,
          address: '0x1234567890abcdef1234567890abcdef12345678',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          network: 'eip155:84532',
          label: 'Main receiving wallet',
        }),
      });
      expect(walletRes.status).toBe(201);
      const wallet = await walletRes.json();
      expect(wallet.active).toBe(true);

      // 5. Create route
      const routeRes = await app.request(`/services/${svc.id}/routes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ method: 'GET', path: '/api/weather', description: 'Current weather data' }),
      });
      expect(routeRes.status).toBe(201);
      const route = await routeRes.json();
      expect(route.enabled).toBe(true);

      // 6. Add price rule — triggers manifest auto-generation
      const priceRes = await app.request(`/routes/${route.id}/pricing`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          scheme: 'exact',
          amount: '$0.01',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          network: 'eip155:84532',
        }),
      });
      expect(priceRes.status).toBe(201);
      const price = await priceRes.json();
      expect(price.amount).toBe('$0.01');

      // 7. Fetch manifest — verify correct shape
      const manifestRes1 = await app.request(`/services/${svc.id}/manifest?env=test`, {
        headers: getHeaders,
      });
      expect(manifestRes1.status).toBe(200);
      const manifest1 = await manifestRes1.json();
      expect(manifest1.serviceId).toBe(svc.id);
      expect(manifest1.environment).toBe('test');
      expect(manifest1.version).toBe(1);
      expect(manifest1.network).toBe('eip155:84532');
      expect(manifest1.wallet).toBeDefined();
      expect(manifest1.wallet.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(manifest1.routes).toBeDefined();
      expect(manifest1.routes['GET /api/weather']).toBeDefined();
      expect(manifest1.routes['GET /api/weather'].accepts).toHaveLength(1);
      expect(manifest1.routes['GET /api/weather'].accepts[0].price).toBe('$0.01');
      expect(manifest1.routes['GET /api/weather'].extensions).toBeDefined();
      expect(manifest1.routes['GET /api/weather'].extensions['payment-identifier']).toEqual({ required: false });
      expect(manifest1.checksum).toBeDefined();

    // 8. Create webhook endpoint BEFORE posting event
    const webhookRes = await app.request(`/services/${svc.id}/webhooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: 'https://my-app.com/webhooks/apex',
        enabled: true,
      }),
    });
    expect(webhookRes.status).toBe(201);
    const webhook = await webhookRes.json();
    expect(webhook.secret).toMatch(/^whsec_/);
    expect(webhook.url).toBe('https://my-app.com/webhooks/apex');

    // Verify GET does not include secret
    const webhookListRes = await app.request(`/services/${svc.id}/webhooks`, {
      headers: getHeaders,
    });
    const webhookList = await webhookListRes.json();
    expect(webhookList).toHaveLength(1);
    expect(webhookList[0].secret).toBeUndefined();

    // 9. Post payment.settled event
    const eventRes = await app.request('/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        serviceId: svc.id,
        routeId: route.id,
        type: 'payment.settled',
        requestId: 'req_integration_001',
        paymentIdentifier: 'pay_integration_001',
        amount: '$0.01',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
        settlementReference: '0xsettlement123',
        timestamp: new Date().toISOString(),
      }),
    });
    expect(eventRes.status).toBe(202);

    // 10. Verify settlement created
    const settlementRes = await app.request(`/services/${svc.id}/settlements`, {
      headers: getHeaders,
    });
    expect(settlementRes.status).toBe(200);
    const settlements = await settlementRes.json();
    expect(settlements.total).toBe(1);
    expect(settlements.settlements[0].amount).toBe('$0.01');
    expect(settlements.settlements[0].status).toBe('pending');
    expect(settlements.settlements[0].settlementReference).toBe('0xsettlement123');

    // 11. Verify webhook delivery was enqueued
    const deliveries = await testDb
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookEndpointId, webhook.id));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe('pending');
    expect(deliveries[0].attempts).toBe(0);
    expect(deliveries[0].payload).toBeDefined();
    const deliveryPayload = deliveries[0].payload as Record<string, unknown>;
    expect(deliveryPayload.type).toBe('payment.settled');
    expect(deliveryPayload.id).toBeDefined();
    expect(deliveryPayload.data).toBeDefined();

    // 12. Change price → verify new manifest version
    const price2Res = await app.request(`/routes/${route.id}/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        scheme: 'exact',
        amount: '$0.05',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      }),
    });
    expect(price2Res.status).toBe(201);

    const manifestRes2 = await app.request(`/services/${svc.id}/manifest?env=test`, {
      headers: getHeaders,
    });
    expect(manifestRes2.status).toBe(200);
    const manifest2 = await manifestRes2.json();
    expect(manifest2.version).toBeGreaterThan(manifest1.version);
    // Verify new price is reflected
    const accepts = manifest2.routes['GET /api/weather'].accepts;
    const hasOldPrice = accepts.some((a: any) => a.price === '$0.01');
    const hasNewPrice = accepts.some((a: any) => a.price === '$0.05');
    expect(hasNewPrice).toBe(true);

    // 13. Add discovery metadata → verify manifest includes bazaar extension
    const discRes = await app.request(`/routes/${route.id}/discovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        discoverable: true,
        category: 'weather',
        tags: ['forecast', 'real-time'],
        description: 'Current weather data for any location',
        mimeType: 'application/json',
        inputSchema: { queryParams: { location: { type: 'string', required: true } } },
        outputSchema: { type: 'object', properties: { temperature: { type: 'number' } } },
        docsUrl: 'https://docs.example.com/weather',
      }),
    });
    expect(discRes.status).toBe(201);

    // Fetch manifest — bazaar extension NOT present (published=false by default)
    const manifestRes3 = await app.request(`/services/${svc.id}/manifest?env=test`, {
      headers: getHeaders,
    });
    expect(manifestRes3.status).toBe(200);
    const manifest3 = await manifestRes3.json();
    expect(manifest3.routes['GET /api/weather'].extensions?.bazaar).toBeUndefined();

    // Now publish the discovery metadata
    const discUpdateRes = await app.request(`/routes/${route.id}/discovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        discoverable: true,
        category: 'weather',
        tags: ['forecast'],
        published: true,
      }),
    });
    expect(discUpdateRes.status).toBe(200);
    const updatedDisc = await discUpdateRes.json();
    expect(updatedDisc.published).toBe(true);

    // Fetch manifest — bazaar extension SHOULD be present now
    const manifestRes4 = await app.request(`/services/${svc.id}/manifest?env=test`, {
      headers: getHeaders,
    });
    expect(manifestRes4.status).toBe(200);
    const manifest4 = await manifestRes4.json();
    expect(manifest4.routes['GET /api/weather'].extensions?.bazaar).toBeDefined();
      expect(manifest4.routes['GET /api/weather'].extensions?.bazaar?.discoverable).toBe(true);
      expect(manifest4.routes['GET /api/weather'].extensions?.bazaar?.category).toBe('weather');
    } finally {
      delete process.env[BOOTSTRAP_TOGGLE];
    }
  });
});
