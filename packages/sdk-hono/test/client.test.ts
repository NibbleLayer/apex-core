import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApexClient } from '../src/client.js';
import { ManifestManager } from '../src/manifest.js';
import { mockManifest } from './fixtures/manifest.mock.js';

const {
  mockFetchManifest,
  mockStartAutoRefresh,
  mockStopAutoRefresh,
  mockGetCached,
  mockManifestOn,
  mockManifestOff,
} = vi.hoisted(() => ({
  mockFetchManifest: vi.fn().mockResolvedValue({}),
  mockStartAutoRefresh: vi.fn(),
  mockStopAutoRefresh: vi.fn(),
  mockGetCached: vi.fn().mockReturnValue(null),
  mockManifestOn: vi.fn(),
  mockManifestOff: vi.fn(),
}));

vi.mock('../src/manifest.js', () => ({
  ManifestManager: vi.fn().mockImplementation(() => ({
    fetchManifest: mockFetchManifest,
    startAutoRefresh: mockStartAutoRefresh,
    stopAutoRefresh: mockStopAutoRefresh,
    getCached: mockGetCached,
    on: mockManifestOn,
    off: mockManifestOff,
  })),
}));

vi.mock('../src/events.js', () => ({
  SDKEventEmitter: vi.fn().mockImplementation(() => ({
    emit: vi.fn(),
    setEventsEndpoint: vi.fn(),
  })),
}));

vi.mock('../src/middleware.js', () => ({
  createMiddlewareFromManifest: vi.fn().mockResolvedValue(
    async (_c: any, next: any) => next(),
  ),
}));

const config = {
  apiKey: 'apex_testkey123',
  serviceId: 'svc_test123',
  environment: 'test' as const,
  apexUrl: 'https://api.apex.nibblelayer.com',
};

describe('createApexClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchManifest.mockResolvedValue(mockManifest);
  });

  it('returns ApexClient with all required methods', () => {
    const client = createApexClient(config);

    expect(client).toBeDefined();
    expect(typeof client.protect).toBe('function');
    expect(typeof client.refreshManifest).toBe('function');
    expect(typeof client.on).toBe('function');
    expect(typeof client.off).toBe('function');
    expect(typeof client.close).toBe('function');
  });

  it('protect() returns a middleware function', async () => {
    const client = createApexClient(config);
    const middleware = await client.protect();

    expect(typeof middleware).toBe('function');
  });

  it('on() registers event listeners that can be removed via off()', async () => {
    const client = createApexClient(config);
    const handler = vi.fn();

    client.on('manifest.refreshed', handler);
    await client.protect();
    client.off('manifest.refreshed', handler);
  });

  it('off() removes event listeners without error', () => {
    const client = createApexClient(config);
    const handler = vi.fn();

    client.on('test.event', handler);
    client.off('test.event', handler);
  });

  it('close() stops auto-refresh and clears listeners', async () => {
    const client = createApexClient(config);

    await client.protect();
    client.close();

    expect(mockStopAutoRefresh).toHaveBeenCalled();
  });

  it('refreshManifest() delegates to manifestManager.fetchManifest', async () => {
    const client = createApexClient(config);

    const result = await client.refreshManifest();

    expect(mockFetchManifest).toHaveBeenCalled();
    expect(result).toEqual(mockManifest);
  });

  it('calls fetchManifest exactly once for multiple protect() calls', async () => {
    const client = createApexClient(config);

    await client.protect();
    await client.protect();
    await client.protect();

    expect(mockFetchManifest).toHaveBeenCalledTimes(1);
  });

  it('applies default config values', () => {
    createApexClient(config);

    const constructorArg = vi.mocked(ManifestManager).mock.calls[0][0];
    expect(constructorArg.refreshIntervalMs).toBe(60000);
    expect(constructorArg.enableIdempotency).toBe(true);
    expect(constructorArg.eventDelivery).toBe('fire-and-forget');
  });
});
