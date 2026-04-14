import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateManifest } from '../src/services/config-service.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  createTestOrg,
  createTestService,
  createTestEnvironment,
  createTestWallet,
  createTestRoute,
  createTestPriceRule,
} from './helpers.js';
import { discoveryMetadata, serviceManifests } from '@nibblelayer/apex-persistence/db';
import { createId } from '../src/utils/id.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

async function setupFullService(mode: 'test' | 'prod' = 'test') {
  const orgId = await createTestOrg();
  const serviceId = await createTestService(orgId, 'Weather API');
  const envId = await createTestEnvironment(serviceId, mode);
  const walletId = await createTestWallet(serviceId, envId);
  const routeId = await createTestRoute(serviceId, 'GET', '/api/weather');
  const priceRuleId = await createTestPriceRule(routeId);
  return { orgId, serviceId, envId, walletId, routeId, priceRuleId };
}

describe('generateManifest', () => {
  it('generates a manifest from realistic data', async () => {
    const { serviceId } = await setupFullService();

    const { manifest, isNew } = await generateManifest(testDb, serviceId, 'test');

    expect(isNew).toBe(true);
    expect(manifest.serviceId).toBe(serviceId);
    expect(manifest.environment).toBe('test');
    expect(manifest.version).toBe(1);
    expect(manifest.network).toBe('eip155:84532');
    expect(manifest.wallet.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(manifest.checksum).toBeDefined();
  });

  it('produces route keys in "METHOD /path" format', async () => {
    const { serviceId } = await setupFullService();

    const { manifest } = await generateManifest(testDb, serviceId, 'test');

    const routeKeys = Object.keys(manifest.routes);
    expect(routeKeys).toContain('GET /api/weather');
  });

  it('populates accepts array from active price rules', async () => {
    const { serviceId, routeId } = await setupFullService();

    const { manifest } = await generateManifest(testDb, serviceId, 'test');

    const routeConfig = manifest.routes['GET /api/weather'];
    expect(routeConfig).toBeDefined();
    expect(routeConfig.accepts).toHaveLength(1);
    expect(routeConfig.accepts[0].scheme).toBe('exact');
    expect(routeConfig.accepts[0].price).toBe('$0.01');
    expect(routeConfig.accepts[0].network).toBe('eip155:84532');
    expect(routeConfig.accepts[0].payTo).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('increments version on each new generation', async () => {
    const { serviceId, routeId } = await setupFullService();

    const r1 = await generateManifest(testDb, serviceId, 'test');
    expect(r1.manifest.version).toBe(1);
    expect(r1.isNew).toBe(true);

    // Change price to force new version
    const { priceRules } = await import('@nibblelayer/apex-persistence/db');
    await testDb
      .update(priceRules)
      .set({ amount: '$0.05' })
      .where(eq(priceRules.routeId, routeId));

    const r2 = await generateManifest(testDb, serviceId, 'test');
    expect(r2.manifest.version).toBe(2);
    expect(r2.isNew).toBe(true);
  });

  it('does not create new version when data is unchanged (idempotency)', async () => {
    const { serviceId } = await setupFullService();

    const r1 = await generateManifest(testDb, serviceId, 'test');
    expect(r1.isNew).toBe(true);

    const r2 = await generateManifest(testDb, serviceId, 'test');
    expect(r2.isNew).toBe(false);
    expect(r2.manifest.version).toBe(r1.manifest.version);
  });

  it('includes payment-identifier extension when idempotency enabled', async () => {
    const { serviceId } = await setupFullService();

    const { manifest } = await generateManifest(testDb, serviceId, 'test');

    const routeConfig = manifest.routes['GET /api/weather'];
    expect(routeConfig.extensions).toBeDefined();
    expect(routeConfig.extensions?.['payment-identifier']).toEqual({ required: false });
  });

  it('includes bazaar extension when discovery is discoverable and published', async () => {
    const { serviceId, routeId } = await setupFullService();

    // Add discovery metadata that is discoverable AND published
    await testDb.insert(discoveryMetadata).values({
      id: createId(),
      routeId,
      discoverable: true,
      category: 'weather',
      tags: ['forecast'],
      description: 'Weather data',
      mimeType: null,
      inputSchema: null,
      outputSchema: null,
      docsUrl: null,
      published: true,
    });

    const { manifest } = await generateManifest(testDb, serviceId, 'test');

    const routeConfig = manifest.routes['GET /api/weather'];
    expect(routeConfig.extensions?.bazaar).toBeDefined();
    expect(routeConfig.extensions?.bazaar?.discoverable).toBe(true);
    expect(routeConfig.extensions?.bazaar?.category).toBe('weather');
    expect(routeConfig.extensions?.bazaar?.tags).toEqual(['forecast']);
  });

  it('excludes routes with no active price rules', async () => {
    const orgId = await createTestOrg();
    const serviceId = await createTestService(orgId);
    const envId = await createTestEnvironment(serviceId);
    await createTestWallet(serviceId, envId);
    const routeId = await createTestRoute(serviceId, 'GET', '/api/noprice');
    // No price rule added

    const { manifest } = await generateManifest(testDb, serviceId, 'test');

    expect(Object.keys(manifest.routes)).toHaveLength(0);
  });

  it('throws if service not found', async () => {
    await expect(
      generateManifest(testDb, 'c_nonexistent', 'test'),
    ).rejects.toThrow('Service not found');
  });

  it('throws if no environment exists', async () => {
    const orgId = await createTestOrg();
    const serviceId = await createTestService(orgId);
    // No environment created

    await expect(
      generateManifest(testDb, serviceId, 'test'),
    ).rejects.toThrow('Environment not found');
  });

  it('throws if no active wallet', async () => {
    const orgId = await createTestOrg();
    const serviceId = await createTestService(orgId);
    await createTestEnvironment(serviceId);
    // No wallet created

    await expect(
      generateManifest(testDb, serviceId, 'test'),
    ).rejects.toThrow('No active wallet destination');
  });
});

// Import eq for the update query in the version increment test
import { eq } from 'drizzle-orm';
