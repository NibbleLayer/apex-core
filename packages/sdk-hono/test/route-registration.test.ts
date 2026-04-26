import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteRegistrar } from '../src/route-registration.js';

const apexUrl = 'https://api.apex.test';
const apiKey = 'apx_sdk_test123';

function createRegistrar() {
  return new RouteRegistrar({ apexUrl, apiKey, heartbeatIntervalMs: 60_000 });
}

describe('RouteRegistrar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('observes supported routes and posts them to /sdk/register with bearer auth', async () => {
    const registrar = createRegistrar();

    registrar.observe('get', '/weather');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith(
      `${apexUrl}/sdk/register`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
        body: JSON.stringify({ routes: [{ method: 'GET', path: '/weather' }] }),
      }),
    );
  });

  it('dedupes repeated route observations', async () => {
    const registrar = createRegistrar();

    registrar.observe('GET', '/weather');
    registrar.observe('GET', '/weather');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('ignores unsupported methods and invalid paths', () => {
    const registrar = createRegistrar();

    registrar.observe('OPTIONS', '/weather');
    registrar.observe('GET', 'weather');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('heartbeat resubmits observed routes', async () => {
    vi.useFakeTimers();
    const registrar = createRegistrar();

    registrar.observe('GET', '/weather');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    registrar.start();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetch).toHaveBeenCalledTimes(2);
    registrar.stop();
  });

  it('does not throw when registration fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));
    const registrar = createRegistrar();

    expect(() => registrar.observe('GET', '/weather')).not.toThrow();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
