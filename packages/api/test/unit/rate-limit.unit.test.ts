import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimitMiddleware, rateLimitPresets } from '../../src/middleware/rate-limit.js';

function createTestApp(options: { windowMs: number; maxRequests: number; keyFn?: (c: any) => string }) {
  const app = new Hono();
  app.use('*', rateLimitMiddleware(options));
  app.get('/test', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit (200)', async () => {
    const app = createTestApp({ windowMs: 60_000, maxRequests: 5 });

    for (let i = 0; i < 5; i++) {
      const res = await app.request('/test');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 when limit is exceeded', async () => {
    const app = createTestApp({ windowMs: 60_000, maxRequests: 2 });

    // First 2 requests pass
    await app.request('/test');
    await app.request('/test');

    // Third request is blocked
    const res = await app.request('/test');
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it('sets X-RateLimit-Limit header', async () => {
    const app = createTestApp({ windowMs: 60_000, maxRequests: 100 });

    const res = await app.request('/test');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
  });

  it('sets X-RateLimit-Remaining header and decrements', async () => {
    const app = createTestApp({ windowMs: 60_000, maxRequests: 5 });

    const res1 = await app.request('/test');
    expect(res1.headers.get('X-RateLimit-Remaining')).toBe('4');

    const res2 = await app.request('/test');
    expect(res2.headers.get('X-RateLimit-Remaining')).toBe('3');
  });

  it('clamps X-RateLimit-Remaining to 0 when exceeded', async () => {
    const app = createTestApp({ windowMs: 60_000, maxRequests: 1 });

    await app.request('/test'); // uses the 1 allowed request
    const res = await app.request('/test'); // exceeds
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('sets X-RateLimit-Reset header as unix timestamp in seconds', async () => {
    const windowMs = 60_000;
    const app = createTestApp({ windowMs, maxRequests: 10 });
    const nowSec = Math.ceil((Date.now() + windowMs) / 1000);

    const res = await app.request('/test');
    const resetHeader = res.headers.get('X-RateLimit-Reset');

    expect(resetHeader).not.toBeNull();
    expect(Number(resetHeader)).toBe(nowSec);
  });

  it('resets the counter after the window expires', async () => {
    const app = createTestApp({ windowMs: 60_000, maxRequests: 1 });

    // First request passes
    const res1 = await app.request('/test');
    expect(res1.status).toBe(200);

    // Second request blocked
    const res2 = await app.request('/test');
    expect(res2.status).toBe(429);

    // Advance time past the window
    vi.advanceTimersByTime(61_000);

    // Request passes again after reset
    const res3 = await app.request('/test');
    expect(res3.status).toBe(200);
  });

  it('uses custom keyFn when provided', async () => {
    let resolveKey: (val: string) => void;
    const capturedKey = new Promise<string>((resolve) => { resolveKey = resolve; });

    const app = createTestApp({
      windowMs: 60_000,
      maxRequests: 1,
      keyFn: (c: any) => {
        const k = c.req.header('x-custom-key') ?? 'unknown';
        resolveKey!(k);
        return k;
      },
    });

    // Request with key "alpha" passes
    const res1 = await app.request('/test', { headers: { 'x-custom-key': 'alpha' } });
    expect(res1.status).toBe(200);
    await expect(capturedKey).resolves.toBe('alpha');

    // Same key "alpha" is blocked
    const res2 = await app.request('/test', { headers: { 'x-custom-key': 'alpha' } });
    expect(res2.status).toBe(429);

    // Different key "beta" passes — independent bucket
    const res3 = await app.request('/test', { headers: { 'x-custom-key': 'beta' } });
    expect(res3.status).toBe(200);
  });
});

describe('rateLimitPresets', () => {
  it('has all expected preset keys', () => {
    expect(Object.keys(rateLimitPresets)).toEqual(['general', 'events', 'auth', 'sdk']);
  });

  it('general preset: 300 requests per 60s', () => {
    expect(rateLimitPresets.general).toEqual({ windowMs: 60_000, maxRequests: 300 });
  });

  it('events preset: 1000 requests per 60s', () => {
    expect(rateLimitPresets.events).toEqual({ windowMs: 60_000, maxRequests: 1000 });
  });

  it('auth preset: 10 requests per 15min', () => {
    expect(rateLimitPresets.auth).toEqual({ windowMs: 15 * 60_000, maxRequests: 10 });
  });

  it('sdk preset: 60 requests per 60s', () => {
    expect(rateLimitPresets.sdk).toEqual({ windowMs: 60_000, maxRequests: 60 });
  });
});
