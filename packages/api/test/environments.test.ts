import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { apiKeys, organizations, services, environments } from '@nibblelayer/apex-persistence/db';
import { environmentRoutes } from '../src/routes/environments.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { createId } from '../src/utils/id.js';
import { testDb } from './setup.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

async function createTestOrgKeyAndService() {
  const orgId = createId();
  const now = new Date();
  await testDb.insert(organizations).values({
    id: orgId,
    name: 'Test Org',
    slug: `test-org-${orgId.slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  });

  const keyId = createId();
  const rawKey = `apex_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  await testDb.insert(apiKeys).values({
    id: keyId,
    organizationId: orgId,
    keyHash,
    label: 'test-key',
    createdAt: now,
    revokedAt: null,
  });

  const serviceId = createId();
  await testDb.insert(services).values({
    id: serviceId,
    organizationId: orgId,
    name: 'Test Service',
    slug: `test-svc-${serviceId.slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  });

  return { orgId, keyId, rawKey, serviceId };
}

describe('POST /services/:serviceId/environments', () => {
  it('creates a test environment with Base Sepolia CAIP-2', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await environmentRoutes.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'test',
        network: 'eip155:84532',
        facilitatorUrl: 'https://x402.org/facilitator',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.mode).toBe('test');
    expect(body.network).toBe('eip155:84532');
    expect(body.serviceId).toBe(serviceId);
  });

  it('creates a prod environment with Base Mainnet CAIP-2', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await environmentRoutes.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'prod',
        network: 'eip155:8453',
        facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.mode).toBe('prod');
    expect(body.network).toBe('eip155:8453');
  });

  it('rejects duplicate mode (two test envs)', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    // Create first test env
    await environmentRoutes.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'test',
        network: 'eip155:84532',
        facilitatorUrl: 'https://x402.org/facilitator',
      }),
    });

    // Try to create second test env
    const res = await environmentRoutes.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'test',
        network: 'eip155:84532',
        facilitatorUrl: 'https://x402.org/facilitator',
      }),
    });

    expect(res.status).toBe(409);
  });

  it('rejects invalid CAIP-2 network', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await environmentRoutes.request(`/services/${serviceId}/environments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'test',
        network: 'invalid-network',
        facilitatorUrl: 'https://x402.org/facilitator',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgKeyAndService();
    const fakeServiceId = createId();

    const res = await environmentRoutes.request(`/services/${fakeServiceId}/environments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'test',
        network: 'eip155:84532',
        facilitatorUrl: 'https://x402.org/facilitator',
      }),
    });

    expect(res.status).toBe(404);
  });
});

describe('GET /services/:serviceId/environments', () => {
  it('returns environments for a service', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const now = new Date();

    await testDb.insert(environments).values([
      {
        id: createId(),
        serviceId,
        mode: 'test',
        network: 'eip155:84532',
        facilitatorUrl: 'https://x402.org/facilitator',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId(),
        serviceId,
        mode: 'prod',
        network: 'eip155:8453',
        facilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await environmentRoutes.request(`/services/${serviceId}/environments`, {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });
});

describe('PATCH /environments/:id', () => {
  it('updates facilitator URL', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = createId();
    const now = new Date();

    await testDb.insert(environments).values({
      id: envId,
      serviceId,
      mode: 'test',
      network: 'eip155:84532',
      facilitatorUrl: 'https://x402.org/facilitator',
      createdAt: now,
      updatedAt: now,
    });

    const res = await environmentRoutes.request(`/environments/${envId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ facilitatorUrl: 'https://new-facilitator.example.com' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.facilitatorUrl).toBe('https://new-facilitator.example.com');
  });
});
