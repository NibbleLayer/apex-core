import { describe, it, expect, afterAll } from 'vitest';
import { eq, and, desc } from 'drizzle-orm';
import { db, pool } from './setup-db.js';
import {
  organizations,
  services,
  environments,
  walletDestinations,
  routes,
  priceRules,
  serviceManifests,
  paymentEvents,
  settlements,
  discoveryMetadata,
  webhookEndpoints,
  apiKeys,
} from '../src/db/schema/index.js';

afterAll(async () => {
  await pool.end();
});

/**
 * Generate a unique CUID2-like ID for testing.
 * In production, the application would use the `cuid2` package.
 */
function testId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── 1. Organization CRUD ──────────────────────────────────────────────────

describe('organizations table', () => {
  it('inserts and retrieves an organization', async () => {
    const id = testId('org');
    await db.insert(organizations).values({
      id,
      name: 'Test Org',
      slug: `test-org-${Date.now()}`,
    });

    const [result] = await db.select().from(organizations).where(eq(organizations.id, id));
    expect(result).toBeDefined();
    expect(result.name).toBe('Test Org');
    expect(result.slug).toContain('test-org-');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);

    await db.delete(organizations).where(eq(organizations.id, id));
  });
});

// ─── 2. Service with organization relation ─────────────────────────────────

describe('services table', () => {
  it('inserts service and retrieves with organization relation', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');

    await db.insert(organizations).values({ id: orgId, name: 'Service Test Org', slug: `sto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Weather API',
      slug: 'weather-api',
      description: 'A test weather service',
    });

    const [result] = await db.select().from(services).where(eq(services.id, svcId));
    expect(result).toBeDefined();
    expect(result.organizationId).toBe(orgId);
    expect(result.description).toBe('A test weather service');

    // Clean up — cascade from org delete
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 3. Environment with CAIP-2 network ────────────────────────────────────

describe('environments table', () => {
  it('inserts environment with CAIP-2 network', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const envId = testId('env');

    await db.insert(organizations).values({ id: orgId, name: 'Env Test Org', slug: `eto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Env Test Svc',
      slug: `ets-${Date.now()}`,
    });
    await db.insert(environments).values({
      id: envId,
      serviceId: svcId,
      mode: 'test',
      network: 'eip155:84532',
      facilitatorUrl: 'https://x402.org/facilitator',
    });

    const [result] = await db.select().from(environments).where(eq(environments.id, envId));
    expect(result).toBeDefined();
    expect(result.mode).toBe('test');
    expect(result.network).toBe('eip155:84532');
    expect(result.facilitatorUrl).toBe('https://x402.org/facilitator');

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 4. Wallet Destination ─────────────────────────────────────────────────

describe('wallet_destinations table', () => {
  it('inserts wallet destination', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const envId = testId('env');
    const walletId = testId('wal');

    await db.insert(organizations).values({ id: orgId, name: 'Wallet Test Org', slug: `wto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Wallet Test Svc',
      slug: `wts-${Date.now()}`,
    });
    await db.insert(environments).values({
      id: envId,
      serviceId: svcId,
      mode: 'prod',
      network: 'eip155:8453',
      facilitatorUrl: 'https://x402.org/facilitator',
    });
    await db.insert(walletDestinations).values({
      id: walletId,
      serviceId: svcId,
      environmentId: envId,
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:8453',
      label: 'Main Wallet',
      active: true,
    });

    const [result] = await db.select().from(walletDestinations).where(eq(walletDestinations.id, walletId));
    expect(result).toBeDefined();
    expect(result.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18');
    expect(result.token).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(result.network).toBe('eip155:8453');
    expect(result.label).toBe('Main Wallet');
    expect(result.active).toBe(true);

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 5. Route with unique constraint ───────────────────────────────────────

describe('routes table', () => {
  it('inserts route and enforces unique (service_id, method, path)', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const routeId = testId('rt');

    await db.insert(organizations).values({ id: orgId, name: 'Route Test Org', slug: `rto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Route Test Svc',
      slug: `rts-${Date.now()}`,
    });
    await db.insert(routes).values({
      id: routeId,
      serviceId: svcId,
      method: 'GET',
      path: '/api/weather',
      description: 'Weather endpoint',
      enabled: true,
    });

    const [result] = await db.select().from(routes).where(eq(routes.id, routeId));
    expect(result).toBeDefined();
    expect(result.method).toBe('GET');
    expect(result.path).toBe('/api/weather');

    // Attempt duplicate (same service + method + path) — should fail
    await expect(
      db.insert(routes).values({
        id: testId('rt2'),
        serviceId: svcId,
        method: 'GET',
        path: '/api/weather',
      }),
    ).rejects.toThrow();

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 6. Price Rule ─────────────────────────────────────────────────────────

describe('price_rules table', () => {
  it('inserts price rule', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const routeId = testId('rt');
    const prId = testId('pr');

    await db.insert(organizations).values({ id: orgId, name: 'Price Test Org', slug: `pto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Price Test Svc',
      slug: `pts-${Date.now()}`,
    });
    await db.insert(routes).values({
      id: routeId,
      serviceId: svcId,
      method: 'GET',
      path: '/api/price-test',
    });
    await db.insert(priceRules).values({
      id: prId,
      routeId,
      scheme: 'exact',
      amount: '$0.01',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      active: true,
    });

    const [result] = await db.select().from(priceRules).where(eq(priceRules.id, prId));
    expect(result).toBeDefined();
    expect(result.scheme).toBe('exact');
    expect(result.amount).toBe('$0.01');
    expect(result.active).toBe(true);

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 7. Service Manifest with version ──────────────────────────────────────

describe('service_manifests table', () => {
  it('inserts manifest and verifies version increment', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const envId = testId('env');

    await db.insert(organizations).values({ id: orgId, name: 'Manifest Test Org', slug: `mto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Manifest Test Svc',
      slug: `mts-${Date.now()}`,
    });
    await db.insert(environments).values({
      id: envId,
      serviceId: svcId,
      mode: 'test',
      network: 'eip155:84532',
      facilitatorUrl: 'https://x402.org/facilitator',
    });

    const manifestPayload = {
      serviceId: svcId,
      environment: 'test',
      version: 1,
      network: 'eip155:84532',
    };

    // Version 1
    const manId1 = testId('man');
    await db.insert(serviceManifests).values({
      id: manId1,
      serviceId: svcId,
      environmentId: envId,
      version: 1,
      payload: manifestPayload,
      checksum: 'abc123sha256hash0000000000000000000000000000000000000000000000000000',
    });

    // Version 2
    const manId2 = testId('man');
    await db.insert(serviceManifests).values({
      id: manId2,
      serviceId: svcId,
      environmentId: envId,
      version: 2,
      payload: { ...manifestPayload, version: 2 },
      checksum: 'def456sha256hash0000000000000000000000000000000000000000000000000000',
    });

    const [v2] = await db.select().from(serviceManifests).where(eq(serviceManifests.id, manId2));
    expect(v2).toBeDefined();
    expect(v2.version).toBe(2);
    expect(v2.checksum).toContain('def456');

    // Duplicate version should fail
    await expect(
      db.insert(serviceManifests).values({
        id: testId('man'),
        serviceId: svcId,
        environmentId: envId,
        version: 1, // Already exists
        payload: {},
        checksum: 'duplicate',
      }),
    ).rejects.toThrow();

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 8. Payment Event ──────────────────────────────────────────────────────

describe('payment_events table', () => {
  it('inserts payment event', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const routeId = testId('rt');
    const evtId = testId('evt');

    await db.insert(organizations).values({ id: orgId, name: 'Event Test Org', slug: `evto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Event Test Svc',
      slug: `evts-${Date.now()}`,
    });
    await db.insert(routes).values({
      id: routeId,
      serviceId: svcId,
      method: 'POST',
      path: '/api/inference',
    });

    await db.insert(paymentEvents).values({
      id: evtId,
      serviceId: svcId,
      routeId,
      type: 'payment.required',
      requestId: 'req_abc123',
      paymentIdentifier: null,
      buyerAddress: null,
      payload: { raw: 'data' },
    });

    const [result] = await db.select().from(paymentEvents).where(eq(paymentEvents.id, evtId));
    expect(result).toBeDefined();
    expect(result.type).toBe('payment.required');
    expect(result.requestId).toBe('req_abc123');
    expect(result.payload).toEqual({ raw: 'data' });

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 9. Settlement ─────────────────────────────────────────────────────────

describe('settlements table', () => {
  it('inserts settlement', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const routeId = testId('rt');
    const evtId = testId('evt');
    const setId = testId('set');

    await db.insert(organizations).values({ id: orgId, name: 'Settlement Test Org', slug: `sto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Settlement Test Svc',
      slug: `sts-${Date.now()}`,
    });
    await db.insert(routes).values({
      id: routeId,
      serviceId: svcId,
      method: 'GET',
      path: '/api/settle-test',
    });
    await db.insert(paymentEvents).values({
      id: evtId,
      serviceId: svcId,
      routeId,
      type: 'payment.settled',
      requestId: 'req_settle_001',
    });

    await db.insert(settlements).values({
      id: setId,
      serviceId: svcId,
      routeId,
      paymentEventId: evtId,
      amount: '$0.01',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      settlementReference: '0xtxhash123',
      status: 'pending',
    });

    const [result] = await db.select().from(settlements).where(eq(settlements.id, setId));
    expect(result).toBeDefined();
    expect(result.amount).toBe('$0.01');
    expect(result.status).toBe('pending');
    expect(result.settlementReference).toBe('0xtxhash123');

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 10. Discovery Metadata with unique route_id ──────────────────────────

describe('discovery_metadata table', () => {
  it('inserts discovery metadata and enforces unique route_id', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const routeId = testId('rt');
    const discId = testId('disc');

    await db.insert(organizations).values({ id: orgId, name: 'Disc Test Org', slug: `dto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Disc Test Svc',
      slug: `dts-${Date.now()}`,
    });
    await db.insert(routes).values({
      id: routeId,
      serviceId: svcId,
      method: 'GET',
      path: '/api/discoverable',
    });

    await db.insert(discoveryMetadata).values({
      id: discId,
      routeId,
      discoverable: true,
      category: 'weather',
      tags: ['forecast', 'real-time'],
      description: 'Weather API',
      mimeType: 'application/json',
      inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { temp: { type: 'number' } } },
      docsUrl: 'https://docs.example.com/weather',
      published: true,
    });

    const [result] = await db.select().from(discoveryMetadata).where(eq(discoveryMetadata.id, discId));
    expect(result).toBeDefined();
    expect(result.discoverable).toBe(true);
    expect(result.category).toBe('weather');
    expect(result.tags).toEqual(['forecast', 'real-time']);
    expect(result.published).toBe(true);

    // Duplicate route_id should fail
    await expect(
      db.insert(discoveryMetadata).values({
        id: testId('disc'),
        routeId, // Same route_id
        discoverable: false,
        published: false,
      }),
    ).rejects.toThrow();

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 11. Webhook Endpoint ──────────────────────────────────────────────────

describe('webhook_endpoints table', () => {
  it('inserts webhook endpoint', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const whId = testId('wh');

    await db.insert(organizations).values({ id: orgId, name: 'WH Test Org', slug: `whto-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'WH Test Svc',
      slug: `whts-${Date.now()}`,
    });

    await db.insert(webhookEndpoints).values({
      id: whId,
      serviceId: svcId,
      url: 'https://example.com/webhook',
      secret: 'whsec_abc123def456',
      enabled: true,
    });

    const [result] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, whId));
    expect(result).toBeDefined();
    expect(result.url).toBe('https://example.com/webhook');
    expect(result.secret).toBe('whsec_abc123def456');
    expect(result.enabled).toBe(true);

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 12. API Key with unique key_hash ──────────────────────────────────────

describe('api_keys table', () => {
  it('inserts API key and enforces unique key_hash', async () => {
    const orgId = testId('org');
    const keyId = testId('key');
    const keyHash = `sha256_${Date.now()}_unique_hash_value`;

    await db.insert(organizations).values({ id: orgId, name: 'Key Test Org', slug: `kto-${Date.now()}` });

    await db.insert(apiKeys).values({
      id: keyId,
      organizationId: orgId,
      keyHash,
      keyPrefix: keyHash.slice(0, 8),
      label: 'Production Key',
    });

    const [result] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId));
    expect(result).toBeDefined();
    expect(result.keyHash).toBe(keyHash);
    expect(result.label).toBe('Production Key');
    expect(result.lastUsedAt).toBeNull();
    expect(result.revokedAt).toBeNull();

    // Duplicate keyHash should fail
    await expect(
      db.insert(apiKeys).values({
        id: testId('key'),
        organizationId: orgId,
        keyHash, // Same hash
        keyPrefix: keyHash.slice(0, 8),
      }),
    ).rejects.toThrow();

    await db.delete(organizations).where(eq(organizations.id, orgId));
  });
});

// ─── 13. Cascade Delete ────────────────────────────────────────────────────

describe('cascade delete', () => {
  it('deleting organization cascades to services, routes, etc.', async () => {
    const orgId = testId('org');
    const svcId = testId('svc');
    const envId = testId('env');
    const routeId = testId('rt');
    const walletId = testId('wal');
    const prId = testId('pr');
    const evtId = testId('evt');
    const setId = testId('set');
    const whId = testId('wh');
    const keyId = testId('key');

    // Create full hierarchy
    await db.insert(organizations).values({ id: orgId, name: 'Cascade Org', slug: `co-${Date.now()}` });
    await db.insert(services).values({
      id: svcId,
      organizationId: orgId,
      name: 'Cascade Svc',
      slug: `cs-${Date.now()}`,
    });
    await db.insert(environments).values({
      id: envId,
      serviceId: svcId,
      mode: 'test',
      network: 'eip155:84532',
      facilitatorUrl: 'https://x402.org/facilitator',
    });
    await db.insert(routes).values({
      id: routeId,
      serviceId: svcId,
      method: 'GET',
      path: '/api/cascade',
    });
    await db.insert(walletDestinations).values({
      id: walletId,
      serviceId: svcId,
      environmentId: envId,
      address: '0x000000000000000000000000000000000000dEaD',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
    });
    await db.insert(priceRules).values({
      id: prId,
      routeId,
      scheme: 'exact',
      amount: '$0.01',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
    });
    await db.insert(paymentEvents).values({
      id: evtId,
      serviceId: svcId,
      routeId,
      type: 'payment.verified',
      requestId: 'req_cascade_001',
    });
    await db.insert(settlements).values({
      id: setId,
      serviceId: svcId,
      routeId,
      paymentEventId: evtId,
      amount: '$0.01',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      status: 'pending',
    });
    await db.insert(webhookEndpoints).values({
      id: whId,
      serviceId: svcId,
      url: 'https://example.com/cascade-webhook',
      secret: 'cascade_secret',
    });
    await db.insert(apiKeys).values({
      id: keyId,
      organizationId: orgId,
      keyHash: `cascade_hash_${Date.now()}`,
      keyPrefix: `cascade_`,
    });

    // Delete the organization — everything should cascade
    await db.delete(organizations).where(eq(organizations.id, orgId));

    // Verify all related records are gone
    const [svc] = await db.select().from(services).where(eq(services.id, svcId));
    expect(svc).toBeUndefined();

    const [env] = await db.select().from(environments).where(eq(environments.id, envId));
    expect(env).toBeUndefined();

    const [rt] = await db.select().from(routes).where(eq(routes.id, routeId));
    expect(rt).toBeUndefined();

    const [wal] = await db.select().from(walletDestinations).where(eq(walletDestinations.id, walletId));
    expect(wal).toBeUndefined();

    const [pr] = await db.select().from(priceRules).where(eq(priceRules.id, prId));
    expect(pr).toBeUndefined();

    const [evt] = await db.select().from(paymentEvents).where(eq(paymentEvents.id, evtId));
    expect(evt).toBeUndefined();

    const [set] = await db.select().from(settlements).where(eq(settlements.id, setId));
    expect(set).toBeUndefined();

    const [wh] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, whId));
    expect(wh).toBeUndefined();

    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId));
    expect(key).toBeUndefined();
  });
});
