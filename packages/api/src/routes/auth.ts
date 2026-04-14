import { Hono } from 'hono';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { apiKeys, organizations } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';

const auth = new Hono();

// POST /auth/login - validate API key and return org info
auth.post('/login', async (c) => {
  const body = await c.req.json<{ api_key?: string }>();
  if (!body.api_key) {
    return c.json({ error: 'API key is required' }, 400);
  }

  const keyHash = crypto.createHash('sha256').update(body.api_key).digest('hex');
  const db = await getDb();

  const [found] = await db
    .select({
      keyId: apiKeys.id,
      orgId: apiKeys.organizationId,
      label: apiKeys.label,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!found || found.revokedAt) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, found.orgId))
    .limit(1);

  return c.json({
    organization_id: org.id,
    name: org.name,
    slug: org.slug,
    label: found.label,
  });
});

// GET /auth/me - return current identity
auth.get('/me', authMiddleware, async (c) => {
  const orgId = c.get('organizationId');
  const db = await getDb();

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404);
  }

  return c.json({
    organization_id: org.id,
    name: org.name,
    slug: org.slug,
    label: c.get('apiKeyLabel'),
  });
});

export const authRoutes = auth;
