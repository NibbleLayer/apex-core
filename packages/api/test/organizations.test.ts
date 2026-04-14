import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { apiKeys, organizations } from '@nibblelayer/apex-persistence/db';
import { organizationRoutes } from '../src/routes/organizations.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { createId } from '../src/utils/id.js';
import { testDb } from './setup.js';

const BOOTSTRAP_TOGGLE = 'ALLOW_UNAUTHENTICATED_ORGANIZATION_BOOTSTRAP';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

afterEach(() => {
  delete process.env[BOOTSTRAP_TOGGLE];
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

describe('POST /organizations', () => {
  it('creates an organization with valid data', async () => {
    process.env[BOOTSTRAP_TOGGLE] = 'true';

    const res = await organizationRoutes.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Org', slug: 'my-org' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('My Org');
    expect(body.slug).toBe('my-org');
    expect(body.id).toBeDefined();
  });

  it('rejects invalid input (empty name)', async () => {
    process.env[BOOTSTRAP_TOGGLE] = 'true';

    const res = await organizationRoutes.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', slug: 'my-org' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('rejects invalid slug format', async () => {
    process.env[BOOTSTRAP_TOGGLE] = 'true';

    const res = await organizationRoutes.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Org', slug: 'INVALID SLUG!' }),
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /organizations/:id', () => {
  it('returns own organization', async () => {
    const { orgId, rawKey } = await createTestOrgWithKey();

    const res = await organizationRoutes.request(`/${orgId}`, {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(orgId);
    expect(body.name).toBe('Test Org');
  });

  it('returns 403 for a different organization', async () => {
    const { rawKey } = await createTestOrgWithKey();
    // Create a second org
    const otherOrgId = createId();
    const now = new Date();
    await testDb.insert(organizations).values({
      id: otherOrgId,
      name: 'Other Org',
      slug: `other-org-${otherOrgId.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    });

    const res = await organizationRoutes.request(`/${otherOrgId}`, {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.status).toBe(403);
  });

  it('returns 403 for non-existent organization (no information leakage)', async () => {
    const { rawKey } = await createTestOrgWithKey();
    const fakeId = createId();

    const res = await organizationRoutes.request(`/${fakeId}`, {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    // Returns 403 rather than 404 to prevent org ID enumeration
    expect(res.status).toBe(403);
  });

  it('returns 401 without authentication', async () => {
    const res = await organizationRoutes.request('/some-id');
    expect(res.status).toBe(401);
  });
});
