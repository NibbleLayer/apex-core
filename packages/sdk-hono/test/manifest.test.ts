import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import {
  buildManifestSigningMessage,
  canonicalizeJson,
  type ApexManifest,
  type SignedManifestEnvelope,
} from '@nibblelayer/apex-contracts';
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
const signedManifestUrl = `${fullConfig.apexUrl}/sdk/manifest`;
const scopedConfig = { ...fullConfig, apiKey: 'apx_sdk_testtoken123' };

function createSignedEnvelope(
  manifest: ApexManifest,
  apiKey = fullConfig.apiKey,
  expiresAt = new Date(Date.now() + 300_000).toISOString(),
): SignedManifestEnvelope {
  const issuedAt = '2026-04-24T00:00:00.000Z';
  const payloadDigest = crypto
    .createHash('sha256')
    .update(canonicalizeJson(manifest))
    .digest('hex');
  const message = buildManifestSigningMessage({
    kid: 'key_test123',
    issuedAt,
    payloadDigest,
  });
  const secret = crypto
    .createHash('sha256')
    .update(`apex-manifest-signing:${apiKey}`)
    .digest();

  return {
    manifest,
    signature: {
      alg: 'HS256',
      kid: 'key_test123',
      issuedAt,
      expiresAt,
      payloadDigest,
      value: crypto.createHmac('sha256', secret).update(message).digest('hex'),
    },
  };
}

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

  it('uses the signed SDK manifest endpoint when enabled', async () => {
    manager = new ManifestManager({ ...fullConfig, useSignedManifest: true });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(createSignedEnvelope(mockManifest)), { status: 200 }),
    );

    const result = await manager.fetchManifest();

    expect(result).toEqual(mockManifest);
    expect(fetch).toHaveBeenCalledWith(
      signedManifestUrl,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('uses the signed SDK manifest endpoint by default for scoped SDK tokens', async () => {
    manager = new ManifestManager(scopedConfig);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(createSignedEnvelope(mockManifest, scopedConfig.apiKey)), {
        status: 200,
      }),
    );

    const result = await manager.fetchManifest();

    expect(result).toEqual(mockManifest);
    expect(fetch).toHaveBeenCalledWith(
      signedManifestUrl,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('accepts a scoped signed manifest without explicit serviceId or environment', async () => {
    manager = new ManifestManager({
      apiKey: scopedConfig.apiKey,
      apexUrl: scopedConfig.apexUrl,
      refreshIntervalMs: scopedConfig.refreshIntervalMs,
      enableIdempotency: scopedConfig.enableIdempotency,
      eventDelivery: scopedConfig.eventDelivery,
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(createSignedEnvelope(mockManifest, scopedConfig.apiKey)), {
        status: 200,
      }),
    );

    const result = await manager.fetchManifest();

    expect(result).toEqual(mockManifest);
    expect(fetch).toHaveBeenCalledWith(
      signedManifestUrl,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('rejects bare unsigned manifests by default for scoped SDK tokens', async () => {
    manager = new ManifestManager(scopedConfig);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockManifest), { status: 200 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexManifestValidationError);
    await expect(promise).rejects.toThrow('Invalid manifest format');
  });

  it('rejects expired signed envelopes by default for scoped SDK tokens', async () => {
    manager = new ManifestManager(scopedConfig);
    const envelope = createSignedEnvelope(
      mockManifest,
      scopedConfig.apiKey,
      new Date(Date.now() - 1_000).toISOString(),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexManifestValidationError);
    await expect(promise).rejects.toMatchObject({
      issues: [expect.objectContaining({ message: 'Manifest signature has expired' })],
    });
  });

  it('uses the legacy manifest endpoint by default for legacy apex keys', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockManifest), { status: 200 }),
    );

    await manager.fetchManifest();

    expect(fetch).toHaveBeenCalledWith(
      manifestUrl,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('fails legacy unsigned mode without serviceId or environment before building a bad URL', () => {
    expect(
      () => new ManifestManager({
        apiKey: fullConfig.apiKey,
        apexUrl: fullConfig.apexUrl,
        refreshIntervalMs: fullConfig.refreshIntervalMs,
        enableIdempotency: fullConfig.enableIdempotency,
        eventDelivery: fullConfig.eventDelivery,
      }),
    ).toThrow('legacy unsigned manifest mode requires serviceId and environment');
  });

  it('uses the legacy manifest endpoint when scoped SDK tokens explicitly disable signed mode', async () => {
    manager = new ManifestManager({ ...scopedConfig, useSignedManifest: false });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockManifest), { status: 200 }),
    );

    await manager.fetchManifest();

    expect(fetch).toHaveBeenCalledWith(
      manifestUrl,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('throws ApexManifestValidationError for a bad signed manifest signature', async () => {
    manager = new ManifestManager({ ...fullConfig, useSignedManifest: true });
    const envelope = createSignedEnvelope(mockManifest);
    envelope.signature.value = '0'.repeat(64);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexManifestValidationError);
    await expect(promise).rejects.toThrow('Invalid manifest format');
  });

  it('rejects an expired signed manifest envelope', async () => {
    manager = new ManifestManager({ ...fullConfig, useSignedManifest: true });
    const envelope = createSignedEnvelope(
      mockManifest,
      fullConfig.apiKey,
      new Date(Date.now() - 1_000).toISOString(),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexManifestValidationError);
    await expect(promise).rejects.toMatchObject({
      issues: [expect.objectContaining({ message: 'Manifest signature has expired' })],
    });
  });

  it('rejects a signed manifest envelope for a different serviceId', async () => {
    manager = new ManifestManager({ ...fullConfig, useSignedManifest: true });
    const envelope = createSignedEnvelope({ ...mockManifest, serviceId: 'svc_other' });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexManifestValidationError);
    await expect(promise).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          message: 'Signed manifest serviceId does not match requested serviceId',
        }),
      ],
    });
  });

  it('rejects a signed manifest envelope for a different environment', async () => {
    manager = new ManifestManager({ ...fullConfig, useSignedManifest: true });
    const envelope = createSignedEnvelope({ ...mockManifest, environment: 'prod' });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200 }),
    );

    const promise = manager.fetchManifest();
    await expect(promise).rejects.toThrow(ApexManifestValidationError);
    await expect(promise).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          message: 'Signed manifest environment does not match requested environment',
        }),
      ],
    });
  });

  it('accepts a schema-valid signed envelope when signature verification is disabled', async () => {
    manager = new ManifestManager({
      ...fullConfig,
      useSignedManifest: true,
      verifySignedManifest: false,
    });
    const envelope = createSignedEnvelope(mockManifest);
    envelope.signature.value = '0'.repeat(64);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(envelope), { status: 200 }),
    );

    await expect(manager.fetchManifest()).resolves.toEqual(mockManifest);
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
