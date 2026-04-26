import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { Hono } from 'hono';
import {
  buildManifestSigningMessage,
  canonicalizeJson,
  type ApexManifest,
  type SignedManifestEnvelope,
} from '@nibblelayer/apex-contracts';
import { apex } from '../src/apex.js';
import { ApexMiddlewareInitializationError } from '../src/errors.js';
import { mockManifest } from './fixtures/manifest.mock.js';

vi.mock('@x402/hono', () => {
  throw new Error('mock x402 import failure');
});

const envToken = 'apx_sdk_envtoken123';
const envUrl = 'https://env.apex.test';
const explicitToken = 'apx_sdk_explicit123';
const explicitUrl = 'https://explicit.apex.test';

function createSignedEnvelope(
  manifest: ApexManifest,
  apiKey: string,
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
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      payloadDigest,
      value: crypto.createHmac('sha256', secret).update(message).digest('hex'),
    },
  };
}

function createApp(middleware = apex()): Hono {
  const app = new Hono();
  app.use('*', middleware);
  app.get('/api/weather', (context) => context.json({ ok: true }));
  return app;
}

describe('apex one-line middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    process.env.APEX_TOKEN = envToken;
    process.env.APEX_URL = envUrl;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('reads APEX_TOKEN and APEX_URL and returns a middleware', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(createSignedEnvelope(mockManifest, envToken)), { status: 200 }),
    );

    const middleware = apex();
    expect(middleware).toBeTypeOf('function');

    await createApp(middleware).request('/api/weather');

    expect(fetch).toHaveBeenCalledWith(
      `${envUrl}/sdk/manifest`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${envToken}` }),
      }),
    );
  });

  it('uses explicit token and apexUrl options instead of environment variables', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(createSignedEnvelope(mockManifest, explicitToken)), { status: 200 }),
    );

    const app = createApp(apex({ token: explicitToken, apexUrl: explicitUrl }));
    await app.request('/api/weather');

    expect(fetch).toHaveBeenCalledWith(
      `${explicitUrl}/sdk/manifest`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${explicitToken}` }),
      }),
    );
  });

  it('throws ApexMiddlewareInitializationError when token is missing', () => {
    delete process.env.APEX_TOKEN;

    expect(() => apex()).toThrow(ApexMiddlewareInitializationError);
    expect(() => apex()).toThrow('Missing Apex SDK token');
  });

  it('throws ApexMiddlewareInitializationError when Apex URL is missing', () => {
    delete process.env.APEX_URL;

    expect(() => apex()).toThrow(ApexMiddlewareInitializationError);
    expect(() => apex()).toThrow('Missing Apex API URL');
  });

  it('lazily initializes once across multiple requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(createSignedEnvelope(mockManifest, envToken)), { status: 200 }),
    );
    const app = createApp();

    expect(fetch).not.toHaveBeenCalled();

    await app.request('/api/weather');
    await app.request('/api/weather');

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
