import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApexClient } from '../src/client.js';
import { SDKEventEmitter } from '../src/events.js';
import { ManifestManager } from '../src/manifest.js';
import { mockManifest } from './fixtures/manifest.mock.js';

vi.mock('../src/middleware.js', () => ({
  createMiddlewareFromManifest: vi.fn().mockResolvedValue(
    async (_c: any, next: any) => next(),
  ),
}));

const manifestWithRelativeEventsEndpoint = {
  ...mockManifest,
  eventsEndpoint: '/events',
  refreshIntervalMs: 5_000,
};

const baseConfig = {
  apiKey: 'apex_testkey123',
  serviceId: 'svc_test123',
  environment: 'test' as const,
  apexUrl: 'https://api.apex.nibblelayer.com/control-plane',
};

describe('manifest alignment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('accepts a manifest with a root-relative events endpoint through the SDK manifest contract path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(manifestWithRelativeEventsEndpoint), { status: 200 }),
      ),
    );

    const manager = new ManifestManager({
      ...baseConfig,
      refreshIntervalMs: 60_000,
      enableIdempotency: true,
      eventDelivery: 'fire-and-forget',
    });

    await expect(manager.fetchManifest()).resolves.toMatchObject({
      eventsEndpoint: '/events',
    });
  });

  it('posts SDK events to the manifest-derived relative ingestion endpoint resolved against apexUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const emitter = new SDKEventEmitter({
      ...baseConfig,
      eventsEndpoint: manifestWithRelativeEventsEndpoint.eventsEndpoint,
      maxRetries: 0,
    } as any);

    emitter.emit('payment.verified', {
      routeId: 'GET /api/weather',
      requestId: 'req_alignment',
      buyerAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '10000',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      settlementReference: '0xsettlementtx',
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/events', baseConfig.apexUrl).toString(),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses manifest refreshIntervalMs instead of the client default after the first manifest fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(manifestWithRelativeEventsEndpoint), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const setIntervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockImplementation((() => 1 as unknown as ReturnType<typeof setInterval>) as typeof setInterval);

    const client = createApexClient({
      ...baseConfig,
      refreshIntervalMs: 60_000,
    });

    await client.protect();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);

    client.close();
  });
});
