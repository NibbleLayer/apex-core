import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { routes } from '@nibblelayer/apex-persistence/db';
import { sdkRoutes } from '../src/routes/sdk.js';
import { resetDbResolver, setDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import { createTestOrg, createTestSdkToken, createTestService } from './helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('POST /sdk/register', () => {
  it('creates SDK route candidates as disabled drafts', async () => {
    const orgId = await createTestOrg();
    const serviceId = await createTestService(orgId);
    const { rawToken } = await createTestSdkToken({
      orgId,
      serviceId,
      scopes: ['manifest:read', 'routes:register'],
    });

    const response = await sdkRoutes.request('/sdk/register', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ routes: [{ method: 'GET', path: '/auto-weather' }] }),
    });

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.created).toBe(1);
    expect(body.seen).toBe(0);
    expect(body.skipped).toBe(0);

    const [created] = await testDb
      .select()
      .from(routes)
      .where(and(eq(routes.serviceId, serviceId), eq(routes.path, '/auto-weather')))
      .limit(1);

    expect(created.source).toBe('sdk');
    expect(created.publicationStatus).toBe('draft');
    expect(created.enabled).toBe(false);
    expect(created.lastSeenAt).toBeInstanceOf(Date);
  });

  it('requires routes:register scope', async () => {
    const orgId = await createTestOrg();
    const serviceId = await createTestService(orgId);
    const { rawToken } = await createTestSdkToken({ orgId, serviceId, scopes: ['manifest:read'] });

    const response = await sdkRoutes.request('/sdk/register', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ routes: [{ method: 'GET', path: '/auto-weather' }] }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'SDK token requires scope: routes:register' });
  });
});
