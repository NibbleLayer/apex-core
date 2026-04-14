import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { apiKeys, organizations } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../src/middleware/auth.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { createId } from '../src/utils/id.js';
import { testDb } from './setup.js';

// Override the DB resolver for all auth tests
beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

/**
 * Helper: create a test org + API key, return the raw key for use in requests.
 */
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
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

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

function createAuthTestApp() {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.get('/protected', (c) => {
    return c.json({
      organizationId: c.get('organizationId'),
      apiKeyId: c.get('apiKeyId'),
      apiKeyLabel: c.get('apiKeyLabel'),
    });
  });
  return app;
}

describe('Auth middleware', () => {
  it('allows access with a valid API key', async () => {
    const { rawKey, orgId, keyId } = await createTestOrgAndKey('test-key');
    const app = createAuthTestApp();

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organizationId).toBe(orgId);
    expect(body.apiKeyId).toBe(keyId);
    expect(body.apiKeyLabel).toBe('test-key');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = createAuthTestApp();
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Missing');
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const app = createAuthTestApp();
    const res = await app.request('/protected', {
      headers: { Authorization: 'Basic something' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid API key', async () => {
    const app = createAuthTestApp();
    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer apex_invalidkey' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid');
  });

  it('returns 401 for a revoked API key', async () => {
    const { rawKey } = await createTestOrgAndKey('revoked-key', true);
    const app = createAuthTestApp();
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${rawKey}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('revoked');
  });
});
