import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { mockManifest } from './fixtures/manifest.mock.js';

// Mock manifest to control the flow
const { mockFetchManifest, mockStartAutoRefresh, mockStopAutoRefresh, mockManifestOn } =
  vi.hoisted(() => ({
    mockFetchManifest: vi.fn().mockResolvedValue({}),
    mockStartAutoRefresh: vi.fn(),
    mockStopAutoRefresh: vi.fn(),
    mockManifestOn: vi.fn(),
  }));

vi.mock('../src/manifest.js', () => ({
  ManifestManager: vi.fn().mockImplementation(() => ({
    fetchManifest: mockFetchManifest,
    startAutoRefresh: mockStartAutoRefresh,
    stopAutoRefresh: mockStopAutoRefresh,
    getCached: vi.fn().mockReturnValue(null),
    on: mockManifestOn,
    off: vi.fn(),
  })),
}));

vi.mock('../src/events.js', () => ({
  SDKEventEmitter: vi.fn().mockImplementation(() => ({
    emit: vi.fn(),
    setEventsEndpoint: vi.fn(),
  })),
}));

// Let the real x402-adapter be used (middleware falls back to it when @x402/hono is unavailable)
vi.mock('../src/middleware.js', async () => {
  const { createPaymentMiddleware } = await import('../src/x402-adapter.js');
  return {
    createMiddlewareFromManifest: vi.fn().mockImplementation(
      (manifest: any) => Promise.resolve(createPaymentMiddleware(manifest)),
    ),
  };
});

import { createApexClient } from '../src/client.js';

describe('Full middleware integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchManifest.mockResolvedValue(mockManifest);
  });

  it('returns 402 for unprotected request', async () => {
    const app = new Hono();
    const apex = createApexClient({
      apiKey: 'apex_test',
      serviceId: 'svc_test',
      environment: 'test',
      apexUrl: 'http://localhost:3000',
    });

    app.use('/api/*', await apex.protect());
    app.get('/api/weather', (c) => c.json({ temp: 22 }));

    const res = await app.request('/api/weather');
    expect(res.status).toBe(402);

    const paymentRequired = res.headers.get('PAYMENT-REQUIRED');
    expect(paymentRequired).toBeTruthy();

    const decoded = JSON.parse(atob(paymentRequired!));
    expect(decoded.accepts).toBeDefined();
    expect(decoded.accepts[0].scheme).toBe('exact');
  });

  it('allows non-protected routes', async () => {
    const app = new Hono();
    const apex = createApexClient({
      apiKey: 'apex_test',
      serviceId: 'svc_test',
      environment: 'test',
      apexUrl: 'http://localhost:3000',
    });

    app.use('/api/*', await apex.protect());
    app.get('/api/weather', (c) => c.json({ temp: 22 }));
    app.get('/health', (c) => c.json({ ok: true }));

    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('passes through protected routes when PAYMENT-SIGNATURE is present', async () => {
    const app = new Hono();
    const apex = createApexClient({
      apiKey: 'apex_test',
      serviceId: 'svc_test',
      environment: 'test',
      apexUrl: 'http://localhost:3000',
    });

    app.use('/api/*', await apex.protect());
    app.get('/api/weather', (c) => c.json({ temp: 22 }));

    const res = await app.request('/api/weather', {
      headers: { 'PAYMENT-SIGNATURE': 'test-sig' },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.temp).toBe(22);
  });

  it('includes idempotency extension in payment requirements', async () => {
    const app = new Hono();
    const apex = createApexClient({
      apiKey: 'apex_test',
      serviceId: 'svc_test',
      environment: 'test',
      apexUrl: 'http://localhost:3000',
    });

    app.use('/api/*', await apex.protect());
    app.get('/api/weather', (c) => c.json({ temp: 22 }));

    const res = await app.request('/api/weather');
    const paymentRequired = res.headers.get('PAYMENT-REQUIRED')!;
    const decoded = JSON.parse(atob(paymentRequired));

    expect(decoded.extensions).toBeDefined();
    expect(decoded.extensions['payment-identifier']).toEqual({ required: false });
  });
});
