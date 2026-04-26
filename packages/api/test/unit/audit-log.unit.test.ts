import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  auditLogMiddleware,
  methodToAction,
  pathToResource,
  extractResourceId,
} from '../../src/middleware/audit-log.js';

describe('auditLogMiddleware', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs POST mutations', async () => {
    const app = new Hono();
    app.use('*', auditLogMiddleware());
    app.post('/services', (c) => {
      c.set('organizationId', 'org_1');
      c.set('apiKeyId', 'key_1');
      return c.json({ ok: true }, 201);
    });

    await app.request('/services', { method: 'POST' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [, jsonStr] = logSpy.mock.calls[0];
    const entry = JSON.parse(jsonStr);
    expect(entry.action).toBe('create');
    expect(entry.organizationId).toBe('org_1');
    expect(entry.actorId).toBe('key_1');
    expect(entry.actorType).toBe('api_key');
    expect(entry.statusCode).toBe(201);
  });

  it('logs PUT mutations', async () => {
    const app = new Hono();
    app.use('*', auditLogMiddleware());
    app.put('/services/svc_1', (c) => {
      c.set('organizationId', 'org_1');
      return c.json({ ok: true });
    });

    await app.request('/services/svc_1', { method: 'PUT' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [, jsonStr] = logSpy.mock.calls[0];
    const entry = JSON.parse(jsonStr);
    expect(entry.action).toBe('update');
  });

  it('logs PATCH mutations', async () => {
    const app = new Hono();
    app.use('*', auditLogMiddleware());
    app.patch('/services/svc_1', (c) => {
      c.set('organizationId', 'org_1');
      return c.json({ ok: true });
    });

    await app.request('/services/svc_1', { method: 'PATCH' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [, jsonStr] = logSpy.mock.calls[0];
    const entry = JSON.parse(jsonStr);
    expect(entry.action).toBe('update');
  });

  it('logs DELETE mutations', async () => {
    const app = new Hono();
    app.use('*', auditLogMiddleware());
    app.delete('/services/svc_1', (c) => {
      c.set('organizationId', 'org_1');
      return c.json({ ok: true });
    });

    await app.request('/services/svc_1', { method: 'DELETE' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [, jsonStr] = logSpy.mock.calls[0];
    const entry = JSON.parse(jsonStr);
    expect(entry.action).toBe('delete');
  });

  it('does NOT log GET requests', async () => {
    const app = new Hono();
    app.use('*', auditLogMiddleware());
    app.get('/services', (c) => {
      c.set('organizationId', 'org_1');
      return c.json([{ id: 'svc_1' }]);
    });

    await app.request('/services');

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('detects sdk_token actor type', async () => {
    const app = new Hono();
    app.use('*', auditLogMiddleware());
    app.post('/routes', (c) => {
      c.set('organizationId', 'org_1');
      c.set('sdkTokenId', 'sdk_1');
      return c.json({ ok: true }, 201);
    });

    await app.request('/routes', { method: 'POST' });

    const [, jsonStr] = logSpy.mock.calls[0];
    const entry = JSON.parse(jsonStr);
    expect(entry.actorType).toBe('sdk_token');
    expect(entry.actorId).toBe('sdk_1');
  });

  it('defaults to system actor when no identity is set', async () => {
    const app = new Hono();
    app.use('*', auditLogMiddleware());
    app.post('/internal/job', (c) => c.json({ ok: true }, 201));

    await app.request('/internal/job', { method: 'POST' });

    const [, jsonStr] = logSpy.mock.calls[0];
    const entry = JSON.parse(jsonStr);
    expect(entry.actorType).toBe('system');
    expect(entry.organizationId).toBe('unknown');
  });
});

describe('methodToAction', () => {
  it('maps POST → create', () => {
    expect(methodToAction('POST')).toBe('create');
  });

  it('maps PUT → update', () => {
    expect(methodToAction('PUT')).toBe('update');
  });

  it('maps PATCH → update', () => {
    expect(methodToAction('PATCH')).toBe('update');
  });

  it('maps DELETE → delete', () => {
    expect(methodToAction('DELETE')).toBe('delete');
  });

  it('returns unknown for unmapped methods', () => {
    expect(methodToAction('OPTIONS')).toBe('unknown');
  });
});

describe('pathToResource', () => {
  it('extracts last segment for nested paths', () => {
    expect(pathToResource('/services/abc/routes')).toBe('route');
  });

  it('handles single-segment paths', () => {
    expect(pathToResource('/services')).toBe('services');
  });

  it('handles empty path', () => {
    expect(pathToResource('/')).toBe('unknown');
  });

  it('handles deeply nested paths', () => {
    expect(pathToResource('/orgs/org_1/services/svc_1/routes')).toBe('route');
  });
});

describe('extractResourceId', () => {
  it('returns param id when provided', () => {
    expect(extractResourceId('/services/svc_1', 'svc_1')).toBe('svc_1');
  });

  it('returns undefined when no param id', () => {
    expect(extractResourceId('/services')).toBeUndefined();
  });
});
