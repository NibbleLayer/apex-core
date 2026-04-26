import type { MiddlewareHandler } from 'hono';

interface RateLimitOptions {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  keyFn?: (c: any) => string; // Key function (default: organizationId or IP)
}

// In-memory rate limiter for OSS single-process mode.
// For hosted/multi-process, replace with Redis-backed store.
export function rateLimitMiddleware(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, maxRequests, keyFn } = options;
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Periodic cleanup
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of hits) {
      if (now > val.resetAt) hits.delete(key);
    }
  }, 60_000);
  // Prevent timer from keeping process alive
  if (cleanup.unref) cleanup.unref();

  return async (c, next) => {
    const key = keyFn
      ? keyFn(c)
      : (c.get('organizationId') ?? c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'global');
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      hits.set(key, record);
    }

    record.count++;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, maxRequests - record.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    if (record.count > maxRequests) {
      return c.json(
        { error: 'Rate limit exceeded', retryAfter: Math.ceil((record.resetAt - now) / 1000) },
        429,
      );
    }

    await next();
  };
}

// Preset configurations for different endpoint categories
export const rateLimitPresets = {
  // General API — generous for self-hosted, tighten for hosted
  general: { windowMs: 60_000, maxRequests: 300 },
  // Event ingestion — high throughput expected
  events: { windowMs: 60_000, maxRequests: 1000 },
  // Auth/login — strict to prevent brute force
  auth: { windowMs: 15 * 60_000, maxRequests: 10 },
  // SDK registration — moderate
  sdk: { windowMs: 60_000, maxRequests: 60 },
};
