import { eq } from 'drizzle-orm';
import { sdkTokens } from '@nibblelayer/apex-persistence/db';
import { getDb } from '../db/resolver.js';
import { hashToken, hasScope, isExpired, SDK_TOKEN_PREFIX } from '../services/sdk-token-service.js';

const REQUIRED_MANIFEST_SCOPE = 'manifest:read';

export function createSdkAuthMiddleware(requiredScope = REQUIRED_MANIFEST_SCOPE) {
  return async (c: any, next: () => Promise<void>) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const rawToken = authHeader.slice(7);
    if (!rawToken.startsWith(SDK_TOKEN_PREFIX)) {
      return c.json({ error: 'Invalid SDK token' }, 401);
    }

    const db = await getDb();
    const [found] = await db
      .select({
        id: sdkTokens.id,
        organizationId: sdkTokens.organizationId,
        serviceId: sdkTokens.serviceId,
        environmentMode: sdkTokens.environmentMode,
        scopes: sdkTokens.scopes,
        expiresAt: sdkTokens.expiresAt,
        revokedAt: sdkTokens.revokedAt,
      })
      .from(sdkTokens)
      .where(eq(sdkTokens.keyHash, hashToken(rawToken)))
      .limit(1);

    if (!found) {
      return c.json({ error: 'Invalid SDK token' }, 401);
    }

    if (found.revokedAt) {
      return c.json({ error: 'SDK token has been revoked' }, 401);
    }

    if (isExpired(found.expiresAt)) {
      return c.json({ error: 'SDK token has expired' }, 401);
    }

    if (!hasScope(found.scopes, requiredScope)) {
      return c.json({ error: `SDK token requires scope: ${requiredScope}` }, 403);
    }

    db.update(sdkTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(sdkTokens.id, found.id))
      .execute()
      .catch(() => {});

    c.set('sdkTokenId', found.id);
    c.set('organizationId', found.organizationId);
    c.set('serviceId', found.serviceId);
    c.set('environmentMode', found.environmentMode);
    c.set('sdkTokenRaw', rawToken);

    await next();
  };
}

export const sdkAuthMiddleware = createSdkAuthMiddleware();
