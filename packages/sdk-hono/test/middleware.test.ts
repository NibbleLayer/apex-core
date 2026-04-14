import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { mockManifest } from './fixtures/manifest.mock.js';

/**
 * The middleware module dynamically imports @x402/hono which initializes
 * network connections. For unit tests we test the adapter fallback path
 * by spying on the import and forcing it to fail.
 *
 * Since dynamic import mocking is complex in vitest, we test via the
 * x402-adapter directly to verify the protocol behavior.
 */
import { createPaymentMiddleware } from '../src/x402-adapter.js';

function createTestApp(manifest: typeof mockManifest) {
  const app = new Hono();
  const middleware = createPaymentMiddleware(manifest);

  app.use('/api/*', middleware);
  app.get('/api/weather', (c) => c.json({ temperature: 22, conditions: 'sunny' }));
  app.get('/unprotected', (c) => c.json({ ok: true }));

  return app;
}

describe('x402-adapter middleware', () => {
  it('returns 402 with PAYMENT-REQUIRED header for unprotected request', async () => {
    const app = createTestApp(mockManifest);
    const res = await app.request('/api/weather', { method: 'GET' });

    expect(res.status).toBe(402);

    const payReqHeader = res.headers.get('PAYMENT-REQUIRED');
    expect(payReqHeader).toBeTruthy();

    const body = await res.json();
    expect(body.error).toBe('Payment Required');
    expect(body.requirements).toBeDefined();
  });

  it('PAYMENT-REQUIRED header contains Base64-encoded JSON', async () => {
    const app = createTestApp(mockManifest);
    const res = await app.request('/api/weather', { method: 'GET' });

    const payReqHeader = res.headers.get('PAYMENT-REQUIRED')!;
    const decoded = JSON.parse(
      Buffer.from(payReqHeader, 'base64').toString('utf-8'),
    );

    expect(decoded.accepts).toBeDefined();
    expect(decoded.accepts).toHaveLength(1);
  });

  it('response includes payment requirements with correct accepts', async () => {
    const app = createTestApp(mockManifest);
    const res = await app.request('/api/weather', { method: 'GET' });
    const body = await res.json();

    const accept = body.requirements.accepts[0];
    expect(accept.scheme).toBe('exact');
    expect(accept.maxAmountRequired).toBe('$0.01');
    expect(accept.network).toBe('eip155:84532');
    expect(accept.payTo).toBe(
      '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    );
    expect(accept.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('passes through non-protected routes', async () => {
    const app = createTestApp(mockManifest);
    const res = await app.request('/unprotected', { method: 'GET' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('passes through when PAYMENT-SIGNATURE header is present', async () => {
    const app = createTestApp(mockManifest);
    const res = await app.request('/api/weather', {
      method: 'GET',
      headers: {
        'PAYMENT-SIGNATURE': 'test-payment-sig',
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.temperature).toBe(22);
  });

  it('route config matches "METHOD /path" keys correctly', async () => {
    const app = createTestApp(mockManifest);

    // Exact match should work
    const res = await app.request('/api/weather', { method: 'GET' });
    expect(res.status).toBe(402);

    // Non-matching path should pass through
    const res2 = await app.request('/api/unknown', { method: 'GET' });
    expect(res2.status).toBe(404); // No route handler registered

    // Non-matching method should pass through
    const res3 = await app.request('/api/weather', { method: 'POST' });
    expect(res3.status).toBe(404);
  });

  it('includes extensions in the payment requirements', async () => {
    const app = createTestApp(mockManifest);
    const res = await app.request('/api/weather', { method: 'GET' });

    const payReqHeader = res.headers.get('PAYMENT-REQUIRED')!;
    const decoded = JSON.parse(
      Buffer.from(payReqHeader, 'base64').toString('utf-8'),
    );

    expect(decoded.extensions).toBeDefined();
    expect(decoded.extensions['payment-identifier']).toEqual({
      required: false,
    });
  });

  it('includes description from route config', async () => {
    const app = createTestApp(mockManifest);
    const res = await app.request('/api/weather', { method: 'GET' });

    const payReqHeader = res.headers.get('PAYMENT-REQUIRED')!;
    const decoded = JSON.parse(
      Buffer.from(payReqHeader, 'base64').toString('utf-8'),
    );

    expect(decoded.description).toBe('Weather data');
  });
});
