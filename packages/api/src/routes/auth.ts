import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { apiKeys, organizations } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { verifyApiKey } from '../crypto.js';

const auth = new Hono();

// POST /auth/login - validate API key and return org info
auth.post('/login', async (c) => {
  const body = await c.req.json<{ api_key?: string }>();
  if (!body.api_key) {
    return c.json({ error: 'API key is required' }, 400);
  }

  const db = await getDb();
  const prefix = body.api_key.slice(0, 8);

  const matchingKeys = await db
    .select({
      keyId: apiKeys.id,
      orgId: apiKeys.organizationId,
      label: apiKeys.label,
      revokedAt: apiKeys.revokedAt,
      keyHash: apiKeys.keyHash,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyPrefix, prefix));

  let found = null;
  for (const keyRow of matchingKeys) {
    if (await verifyApiKey(body.api_key, keyRow.keyHash)) {
      found = keyRow;
      break;
    }
  }

  if (!found || found.revokedAt) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, found.orgId))
    .limit(1);

  return c.json({
    organizationId: org.id,
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
    organizationId: org.id,
    name: org.name,
    slug: org.slug,
    label: c.get('apiKeyLabel'),
  });
});

export const authRoutes = auth;
