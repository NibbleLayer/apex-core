import { randomUUID } from 'node:crypto';

/**
 * Audit log middleware — records mutation operations (POST, PUT, PATCH, DELETE).
 * In OSS mode, logs to console. In hosted mode, plug in a DB writer.
 */
export function auditLogMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const method = c.req.method;

    await next();

    // Only audit mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // Read context values AFTER next() so auth middleware values are available
      const orgId = c.get('organizationId') ?? c.get('sdkOrganizationId') ?? 'unknown';
      const actorId = c.get('apiKeyId') ?? c.get('sdkTokenId') ?? 'anonymous';
      const actorType = c.get('sdkTokenId')
        ? 'sdk_token'
        : c.get('apiKeyId')
          ? 'api_key'
          : 'system';

      const path = new URL(c.req.url).pathname;
      const entry = {
        id: randomUUID(),
        organizationId: orgId,
        actorId,
        actorType,
        action: methodToAction(method),
        resource: pathToResource(path),
        resourceId: extractResourceId(path, c.req.param('id')),
        statusCode: c.res.status,
        timestamp: new Date().toISOString(),
      };
      // OSS: log to console. Hosted: replace with DB write.
      console.log('[AUDIT]', JSON.stringify(entry));
    }
  };
}

export function methodToAction(method: string): string {
  const map: Record<string, string> = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };
  return map[method] ?? 'unknown';
}

export function pathToResource(path: string): string {
  const segments = path.split('/').filter(Boolean);
  // e.g., /services/abc/routes → 'routes'
  // e.g., /services → 'services'
  return segments.length >= 2
    ? segments[segments.length - 1].replace(/s$/, '')
    : segments[0] ?? 'unknown';
}

export function extractResourceId(path: string, paramId?: string): string | undefined {
  return paramId;
}
