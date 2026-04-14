import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { apiKeys } from '@nibblelayer/apex-persistence/db';
import { getDb } from '../db/resolver.js';

export function createAuthMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const rawKey = authHeader.slice(7);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const db = await getDb();
    const [found] = await db
      .select({
        id: apiKeys.id,
        organizationId: apiKeys.organizationId,
        label: apiKeys.label,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!found) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    if (found.revokedAt) {
      return c.json({ error: 'API key has been revoked' }, 401);
    }

    // Update last_used_at (fire and forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, found.id))
      .execute()
      .catch(() => {});

    c.set('organizationId', found.organizationId);
    c.set('apiKeyId', found.id);
    c.set('apiKeyLabel', found.label);

    await next();
  };
}

export const authMiddleware = createAuthMiddleware();

/**
 * Generate a new API key and return both the raw key (shown once) and the hash (stored).
 */
export function generateApiKey(): { rawKey: string; keyHash: string } {
  const bytes = crypto.randomBytes(32);
  const rawKey = `apex_${bytes.toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, keyHash };
}
