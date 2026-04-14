import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createApexClient } from '../src/client.js';
import { ManifestManager } from '../src/manifest.js';
import { mockManifest, mockManifestV2 } from './fixtures/manifest.mock.js';

const {
  mockFetchManifest,
  mockStartAutoRefresh,
  mockStopAutoRefresh,
  mockGetCached,
  mockManifestOn,
} = vi.hoisted(() => ({
  mockFetchManifest: vi.fn().mockResolvedValue({}),
  mockStartAutoRefresh: vi.fn(),
  mockStopAutoRefresh: vi.fn(),
  mockGetCached: vi.fn().mockReturnValue(null),
  mockManifestOn: vi.fn(),
}));

vi.mock('../src/manifest.js', () => ({
  ManifestManager: vi.fn().mockImplementation(() => ({
    fetchManifest: mockFetchManifest,
    startAutoRefresh: mockStartAutoRefresh,
    stopAutoRefresh: mockStopAutoRefresh,
    getCached: mockGetCached,
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

// Track which manifest version the middleware was built with
const { mockCreateMiddleware, lastMiddlewareManifest } = vi.hoisted(() => {
  let _lastManifest: any = null;
  return {
    mockCreateMiddleware: vi.fn().mockImplementation((manifest: any) => {
      _lastManifest = manifest;
      // Build a middleware that returns the version it was built with
      return Promise.resolve(async (c: any, next: any) => {
        c.header('X-Manifest-Version', String(manifest.version));
        return next();
      });
    }),
    get lastMiddlewareManifest() {
      return _lastManifest;
    },
  };
});

vi.mock('../src/middleware.js', () => ({
  createMiddlewareFromManifest: mockCreateMiddleware,
}));

describe('Manifest refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchManifest.mockResolvedValue(mockManifest);
  });

  it('initializes with v1 manifest and rebuilds middleware on refresh', async () => {
    const app = new Hono();
    const apex = createApexClient({
      apiKey: 'apex_test',
      serviceId: 'svc_test',
      environment: 'test',
      apexUrl: 'http://localhost:3000',
    });

    app.use('/api/*', await apex.protect());
    app.get('/api/data', (c) => c.json({ ok: true }));

    // Initial middleware built with v1 manifest
    expect(mockCreateMiddleware).toHaveBeenCalledTimes(1);
    expect(mockCreateMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1 }),
      expect.any(Function),
    );

    // First request uses v1 middleware
    const res1 = await app.request('/api/data');
    expect(res1.headers.get('X-Manifest-Version')).toBe('1');

    // Simulate manifest refresh by triggering the 'manifest.refreshed' event
    // The client registers a handler via manifestManager.on()
    // Find the handler registered for 'manifest.refreshed'
    const refreshedCalls = mockManifestOn.mock.calls.filter(
      (call: any[]) => call[0] === 'manifest.refreshed',
    );

    // The client registers TWO handlers for 'manifest.refreshed':
    // 1. Forward to client listeners (line 45-47 in client.ts)
    // 2. Rebuild middleware (line 83-85 in client.ts, registered in ensureInitialized)
    // Both were registered during protect()
    expect(refreshedCalls.length).toBeGreaterThanOrEqual(1);

    // Get the last handler (the rebuild one from ensureInitialized)
    const rebuildHandler =
      refreshedCalls[refreshedCalls.length - 1][1];

    // Simulate manifest refresh with v2
    await rebuildHandler(mockManifestV2);

    // Middleware rebuilt with v2
    expect(mockCreateMiddleware).toHaveBeenCalledTimes(2);
    expect(mockCreateMiddleware).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 2 }),
      expect.any(Function),
    );

    // Subsequent request uses v2 middleware
    const res2 = await app.request('/api/data');
    expect(res2.headers.get('X-Manifest-Version')).toBe('2');
  });

  it('client listeners receive manifest.refreshed events', async () => {
    const apex = createApexClient({
      apiKey: 'apex_test',
      serviceId: 'svc_test',
      environment: 'test',
      apexUrl: 'http://localhost:3000',
    });

    const refreshHandler = vi.fn();
    apex.on('manifest.refreshed', refreshHandler);

    await apex.protect();

    // Find the forwarding handler registered by the client
    const refreshedCalls = mockManifestOn.mock.calls.filter(
      (call: any[]) => call[0] === 'manifest.refreshed',
    );
    // First handler is the forward handler
    const forwardHandler = refreshedCalls[0][1];

    // Simulate event
    forwardHandler(mockManifest);

    expect(refreshHandler).toHaveBeenCalledWith(mockManifest);
  });

  it('client listeners receive manifest.stale events', async () => {
    const apex = createApexClient({
      apiKey: 'apex_test',
      serviceId: 'svc_test',
      environment: 'test',
      apexUrl: 'http://localhost:3000',
    });

    const staleHandler = vi.fn();
    apex.on('manifest.stale', staleHandler);

    await apex.protect();

    // Find the forwarding handler for manifest.stale
    const staleCalls = mockManifestOn.mock.calls.filter(
      (call: any[]) => call[0] === 'manifest.stale',
    );
    expect(staleCalls.length).toBeGreaterThanOrEqual(1);

    const forwardHandler = staleCalls[0][1];
    forwardHandler(mockManifest);

    expect(staleHandler).toHaveBeenCalledWith(mockManifest);
  });
});
