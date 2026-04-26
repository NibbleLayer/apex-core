import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { createSdkAuthMiddleware } from '../../src/middleware/sdk-auth.js';
import { resetDbResolver, setDbResolver } from '../../src/db/resolver.js';
import { hashToken } from '../../src/services/sdk-token-service.js';

const rawToken = 'apx_sdk_testtoken';

function createDbResolver(scopes: string[]) {
  const found = {
    id: 'sdk_123',
    organizationId: 'org_123',
    serviceId: 'svc_123',
    environmentMode: 'test',
    scopes,
    expiresAt: null,
    revokedAt: null,
  };
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: () => [found],
  };
  const updateChain = {
    set: () => updateChain,
    where: () => updateChain,
    execute: () => Promise.resolve(),
  };

  return async () => ({
    select: () => selectChain,
    update: () => updateChain,
  } as any);
}

describe('createSdkAuthMiddleware', () => {
  afterEach(() => {
    resetDbResolver();
  });

  it('allows callers to require a non-manifest scope', async () => {
    setDbResolver(createDbResolver(['manifest:read', 'routes:register']));
    const app = new Hono();
    app.get('/protected', createSdkAuthMiddleware('routes:register'), (c) => c.json({ serviceId: c.get('serviceId') }));

    const response = await app.request('/protected', {
      headers: { Authorization: `Bearer ${rawToken}` },
    });

    expect(hashToken(rawToken)).toHaveLength(64);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ serviceId: 'svc_123' });
  });

  it('returns a clear 403 when the required scope is missing', async () => {
    setDbResolver(createDbResolver(['manifest:read']));
    const app = new Hono();
    app.get('/protected', createSdkAuthMiddleware('routes:register'), (c) => c.json({ ok: true }));

    const response = await app.request('/protected', {
      headers: { Authorization: `Bearer ${rawToken}` },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'SDK token requires scope: routes:register' });
  });
});
