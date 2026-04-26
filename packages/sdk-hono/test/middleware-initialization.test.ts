import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockManifest } from './fixtures/manifest.mock.js';

vi.mock('@x402/hono', () => {
  throw new Error('mock x402 import failure');
});

describe('createMiddlewareFromManifest initialization safety', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('fails closed in production when real x402 middleware cannot initialize', async () => {
    process.env.NODE_ENV = 'production';
    const { createMiddlewareFromManifest } = await import('../src/middleware.js');
    const { ApexMiddlewareInitializationError } = await import('../src/errors.js');

    await expect(
      createMiddlewareFromManifest(mockManifest, vi.fn()),
    ).rejects.toThrow(ApexMiddlewareInitializationError);

    await expect(
      createMiddlewareFromManifest(mockManifest, vi.fn()),
    ).rejects.toThrow(
      'Apex Hono middleware failed to initialize real x402 middleware; production is fail-closed.',
    );
  });

  it('keeps dev/test fallback available with a visible warning', async () => {
    process.env.NODE_ENV = 'test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { createMiddlewareFromManifest } = await import('../src/middleware.js');

    const middleware = await createMiddlewareFromManifest(mockManifest, vi.fn());

    expect(middleware).toBeTypeOf('function');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('dev/test-only fallback'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unsafe for production'),
    );
  });
});
