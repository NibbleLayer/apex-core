import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { apiKeys, organizations } from '@nibblelayer/apex-persistence/db';
import { authRoutes } from '../src/routes/auth.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { createId } from '../src/utils/id.js';
import { hashApiKey } from '../src/crypto.js';
import { testDb } from './setup.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

async function createTestOrgAndKey(label?: string, revoked = false) {
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
  const keyHash = await hashApiKey(rawKey);

  await testDb.insert(apiKeys).values({
    id: keyId,
    organizationId: orgId,
    keyHash,
    label: label ?? null,
    createdAt: now,
    revokedAt: revoked ? now : null,
  });

  return { orgId, keyId, rawKey, keyHash };
}

describe('POST /auth/login', () => {
  it('returns org info with valid API key', async () => {
    const { rawKey, orgId } = await createTestOrgAndKey('login-key');

    const res = await authRoutes.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: rawKey }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organization_id).toBe(orgId);
    expect(body.label).toBe('login-key');
    expect(body.name).toBe('Test Org');
    expect(body.slug).toBeDefined();
  });

  it('returns 401 with invalid API key', async () => {
    const res = await authRoutes.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'apex_invalid' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  it('returns 401 with revoked API key', async () => {
    const { rawKey } = await createTestOrgAndKey('revoked', true);

    const res = await authRoutes.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: rawKey }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 400 when api_key is missing', async () => {
    const res = await authRoutes.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });
});

describe('GET /auth/me', () => {
  it('returns current identity with valid Bearer token', async () => {
    const { rawKey, orgId } = await createTestOrgAndKey('me-key');

    const res = await authRoutes.request('/me', {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organization_id).toBe(orgId);
    expect(body.label).toBe('me-key');
  });

  it('returns 401 without Bearer token', async () => {
    const res = await authRoutes.request('/me');
    expect(res.status).toBe(401);
  });
});
