import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { apiKeys, organizations, services, environments } from '@nibblelayer/apex-persistence/db';
import { serviceRoutes } from '../src/routes/services.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { createId } from '../src/utils/id.js';
import { testDb } from './setup.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

async function createTestOrgWithKey() {
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

  return { orgId, keyId, rawKey };
}

describe('POST /services', () => {
  it('creates a service under the authenticated organization', async () => {
    const { orgId, rawKey } = await createTestOrgWithKey();

    const res = await serviceRoutes.request('/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Weather API',
        slug: 'weather-api',
        description: 'A weather service',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Weather API');
    expect(body.slug).toBe('weather-api');
    expect(body.organizationId).toBe(orgId);
    expect(body.id).toBeDefined();
  });

  it('rejects invalid input', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await serviceRoutes.request('/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: '', slug: '' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await serviceRoutes.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', slug: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /services/:id', () => {
  it('returns service with environments and route count', async () => {
    const { orgId, rawKey } = await createTestOrgWithKey();
    const serviceId = createId();
    const now = new Date();

    await testDb.insert(services).values({
      id: serviceId,
      organizationId: orgId,
      name: 'Test Service',
      slug: 'test-service',
      description: 'Test',
      createdAt: now,
      updatedAt: now,
    });

    const res = await serviceRoutes.request(`/${serviceId}`, {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(serviceId);
    expect(body.name).toBe('Test Service');
    expect(body.environments).toEqual([]);
    expect(body.routeCount).toBe(0);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();
    const fakeId = createId();

    const res = await serviceRoutes.request(`/${fakeId}`, {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /services/:id', () => {
  it('updates service name and description', async () => {
    const { orgId, rawKey } = await createTestOrgWithKey();
    const serviceId = createId();
    const now = new Date();

    await testDb.insert(services).values({
      id: serviceId,
      organizationId: orgId,
      name: 'Original Name',
      slug: 'original-slug',
      description: 'Original desc',
      createdAt: now,
      updatedAt: now,
    });

    const res = await serviceRoutes.request(`/${serviceId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${rawKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated Name', description: 'Updated desc' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated Name');
    expect(body.description).toBe('Updated desc');
  });
});
