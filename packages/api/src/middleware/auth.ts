import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { apiKeys } from '@nibblelayer/apex-persistence/db';
import { getDb } from '../db/resolver.js';
import { hashApiKey, verifyApiKey } from '../crypto.js';

export function createAuthMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const rawKey = authHeader.slice(7);
    const prefix = rawKey.slice(0, 8);

    const db = await getDb();
    const matchingKeys = await db
      .select({
        id: apiKeys.id,
        organizationId: apiKeys.organizationId,
        label: apiKeys.label,
        revokedAt: apiKeys.revokedAt,
        keyHash: apiKeys.keyHash,
      })
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, prefix));

    let found = null;
    for (const keyRow of matchingKeys) {
      if (await verifyApiKey(rawKey, keyRow.keyHash)) {
        found = keyRow;
        break;
      }
    }

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
export async function generateApiKey(): Promise<{ rawKey: string; keyHash: string }> {
  const bytes = crypto.randomBytes(32);
  const rawKey = `apex_${bytes.toString('hex')}`;
  const keyHash = await hashApiKey(rawKey);
  return { rawKey, keyHash };
}
