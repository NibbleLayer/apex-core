import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManifestManager } from '../src/manifest.js';
import { ApexConnectionError, ApexManifestValidationError } from '../src/errors.js';
import { mockManifest, mockManifestV2 } from './fixtures/manifest.mock.js';

const fullConfig = {
  apiKey: 'apex_testkey123',
  serviceId: 'svc_test123',
  environment: 'test' as const,
  apexUrl: 'https://api.apex.nibblelayer.com',
  refreshIntervalMs: 60000,
  enableIdempotency: true,
  eventDelivery: 'fire-and-forget' as const,
};

const manifestUrl = `${fullConfig.apexUrl}/services/${fullConfig.serviceId}/manifest?env=${fullConfig.environment}`;

describe('ManifestManager', () => {
  let manager: ManifestManager;

  beforeEach(() => {
    manager = new ManifestManager(fullConfig);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    manager.stopAutoRefresh();
    vi.restoreAllMocks();
  });

  it('fetches and returns a valid manifest', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockManifest), { status: 200 }),
    );

    const result = await manager.fetchManifest();

    expect(result).toEqual(mockManifest);
    expect(fetch).toHaveBeenCalledWith(
      manifestUrl,
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${fullConfig.apiKey}`,
          Accept: 'application/json',
        },
      }),
    );
  });

  it('caches manifest in memory', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockManifest), { status: 200 }),
    );

    const first = await manager.fetchManifest();
    const cached = manager.getCached();

    expect(cached).toEqual(first);
    expect(cached).toEqual(mockManifest);
  });

  it('returns cached manifest on subsequent fetch failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockManifest), { status: 200 }),
      )
      .mockRejectedValueOnce(new Error('Network error'));

    await manager.fetchManifest();

    const staleSpy = vi.fn();
    manager.on('manifest.stale', staleSpy);

    const result = await manager.fetchManifest();

    expect(result).toEqual(mockManifest);
    expect(staleSpy).toHaveBeenCalledWith(mockManifest);
  });

  it('throws ApexConnectionError when fetch fails with no cache', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    await expect(manager.fetchManifest()).rejects.toThrow(ApexConnectionError);
    await expect(manager.fetchManifest()).rejects.toThrow(
      'Failed to connect to Apex',
    );
  });

  it('throws ApexConnectionError on HTTP error with no cache', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexConnectionError);
    await expect(promise).rejects.toThrow('HTTP 401');
  });

  it('throws ApexManifestValidationError on invalid manifest with no cache', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ invalid: true }), { status: 200 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexManifestValidationError);
    await expect(promise).rejects.toThrow('Invalid manifest format');
  });

  it('emits manifest.refreshed when version changes', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockManifest), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockManifestV2), { status: 200 }),
      );

    const refreshedSpy = vi.fn();
    manager.on('manifest.refreshed', refreshedSpy);

    await manager.fetchManifest();
    expect(refreshedSpy).toHaveBeenCalledWith(mockManifest);

    await manager.fetchManifest();
    expect(refreshedSpy).toHaveBeenCalledWith(mockManifestV2);
    expect(refreshedSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT emit manifest.refreshed when version is unchanged', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockManifest), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockManifest), { status: 200 }),
      );

    const refreshedSpy = vi.fn();
    manager.on('manifest.refreshed', refreshedSpy);

    await manager.fetchManifest();
    expect(refreshedSpy).toHaveBeenCalledTimes(1);

    await manager.fetchManifest();
    // No additional emission — same version
    expect(refreshedSpy).toHaveBeenCalledTimes(1);
  });

  it('starts and stops auto-refresh interval', () => {
    vi.useFakeTimers();

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockManifest), { status: 200 }),
    );

    manager.startAutoRefresh();

    // Advance one interval
    vi.advanceTimersByTime(fullConfig.refreshIntervalMs);

    expect(fetch).toHaveBeenCalledTimes(1);

    // Stop and advance — no more calls
    manager.stopAutoRefresh();
    vi.advanceTimersByTime(fullConfig.refreshIntervalMs * 3);

    // Still only 1 call (the one before stop)
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('returns stale cache on validation failure', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockManifest), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ garbage: true }), { status: 200 }),
      );

    await manager.fetchManifest();

    const staleSpy = vi.fn();
    manager.on('manifest.stale', staleSpy);

    const result = await manager.fetchManifest();

    expect(result).toEqual(mockManifest);
    expect(staleSpy).toHaveBeenCalledWith(mockManifest);
  });

  it('removes event listeners with off()', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockManifest), { status: 200 }),
    );

    const handler = vi.fn();
    manager.on('manifest.refreshed', handler);
    manager.off('manifest.refreshed', handler);

    await manager.fetchManifest();
    expect(handler).not.toHaveBeenCalled();
  });
});
