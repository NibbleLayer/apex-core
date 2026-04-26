import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SDKEventEmitter, buildPaymentEventPayload } from '../src/events.js';

const config = {
  apexUrl: 'https://api.apex.nibblelayer.com',
  apiKey: 'apex_testkey123',
  serviceId: 'svc_test123',
  maxRetries: 3,
};

const eventsUrl = `${config.apexUrl}/events`;

const validEventData: Record<string, unknown> = {
  routeId: 'GET /api/weather',
  requestId: 'req_abc123',
  paymentIdentifier: 'pay_abc123',
  buyerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  amount: '10000',
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  network: 'eip155:84532',
  settlementReference: '0xsettlementtx',
};

describe('SDKEventEmitter', () => {
  let emitter: SDKEventEmitter;

  beforeEach(() => {
    emitter = new SDKEventEmitter(config);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits event by POSTing to events endpoint', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 202 }),
    );

    emitter.emit('payment.verified', validEventData);

    // Wait for async processing
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    expect(fetch).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
      }),
    );

    // Verify payload structure
    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call![1]!.body as string);
    expect(body.serviceId).toBe(config.serviceId);
    expect(body.type).toBe('payment.verified');
    expect(body.routeId).toBe('GET /api/weather');
    expect(body.requestId).toBe('req_abc123');
    expect(body.paymentIdentifier).toBe('pay_abc123');
    expect(body.timestamp).toBeDefined();
  });

  it('validates payload against schema before sending', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 202 }),
    );

    // Emit with valid data — should be sent
    emitter.emit('payment.verified', validEventData);

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('does not send invalid payload', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Emit with missing required fields
    emitter.emit('payment.verified', {});

    // Give it a tick to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Invalid event payload:',
      expect.any(Array),
    );

    consoleErrorSpy.mockRestore();
  });

  it('retries on failed emission up to maxRetries', async () => {
    vi.useFakeTimers();

    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    emitter.emit('payment.verified', validEventData);

    // Initial attempt
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Retry 1 (after 1s backoff)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);

    // Retry 2 (after 2s backoff)
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(3);

    // Retry 3 — max reached, event dropped
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetch).toHaveBeenCalledTimes(4);

    // No more retries
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });

  it('logs error and drops event after all retries fail', async () => {
    vi.useFakeTimers();

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    emitter.emit('payment.verified', validEventData);

    // Run through all retries
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(3000);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to emit event after'),
      'payment.verified',
      expect.any(Error),
    );

    // Event should be dropped from queue
    expect(emitter.pendingCount).toBe(0);

    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('succeeds on retry after initial failure', async () => {
    vi.useFakeTimers();

    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    emitter.emit('payment.verified', validEventData);

    // Initial attempt — fails
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Retry 1 — succeeds
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);

    // No more calls
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(2);

    expect(emitter.pendingCount).toBe(0);

    vi.useRealTimers();
  });

  it('accepts HTTP 202 as success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 202 }),
    );

    emitter.emit('payment.settled', {
      ...validEventData,
      settlementReference: '0xtxhash123',
    });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    expect(emitter.pendingCount).toBe(0);
  });

  it('accepts HTTP 200 as success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );

    emitter.emit('payment.settled', validEventData);

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    expect(emitter.pendingCount).toBe(0);
  });

  it('maps x402 nested context before sending', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 202 }),
    );

    emitter.emit('payment.settled', {
      requirements: {
        extensions: {
          apex: {
            routeId: 'route_123',
            routeKey: 'GET /api/weather',
          },
        },
        accepts: [
          {
            price: '$0.01',
            network: 'eip155:84532',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          },
        ],
      },
      paymentPayload: {
        paymentIdentifier: 'pay_123',
        payload: {
          authorization: {
            from: '0x1234567890abcdef1234567890abcdef12345678',
          },
        },
      },
      result: {
        txHash: '0xsettled',
      },
    });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const call = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(call![1]!.body as string);
    expect(body).toMatchObject({
      routeId: 'route_123',
      requestId: 'pay_123',
      paymentIdentifier: 'pay_123',
      buyerAddress: '0x1234567890abcdef1234567890abcdef12345678',
      amount: '$0.01',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      settlementReference: '0xsettled',
    });
  });
});

describe('buildPaymentEventPayload', () => {
  it('preserves direct event payload fields', () => {
    const payload = buildPaymentEventPayload({
      serviceId: config.serviceId,
      type: 'payment.verified',
      data: validEventData,
      now: new Date('2026-04-12T00:00:00.000Z'),
    });

    expect(payload).toMatchObject({
      serviceId: config.serviceId,
      type: 'payment.verified',
      routeId: 'GET /api/weather',
      requestId: 'req_abc123',
      paymentIdentifier: 'pay_abc123',
      timestamp: '2026-04-12T00:00:00.000Z',
    });
  });

  it('maps x402 nested route identity and payment context', () => {
    const payload = buildPaymentEventPayload({
      serviceId: config.serviceId,
      type: 'payment.settled',
      now: new Date('2026-04-12T00:00:00.000Z'),
      data: {
        requirements: {
          extensions: { apex: { routeId: 'route_123', routeKey: 'GET /api/weather' } },
          accepts: [
            {
              maxAmountRequired: '10000',
              network: 'eip155:84532',
              token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            },
          ],
        },
        paymentPayload: {
          nonce: 'nonce_123',
          payload: {
            authorization: {
              from: '0x1234567890abcdef1234567890abcdef12345678',
            },
          },
        },
        result: {
          settlementReference: '0xsettled',
        },
      },
    });

    expect(payload).toMatchObject({
      routeId: 'route_123',
      requestId: 'nonce_123',
      paymentIdentifier: 'nonce_123',
      amount: '10000',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      settlementReference: '0xsettled',
    });
  });

  it('returns null when route or request identity is missing', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(buildPaymentEventPayload({
      serviceId: config.serviceId,
      type: 'payment.verified',
      data: { routeId: 'route_123' },
    })).toBeNull();

    expect(buildPaymentEventPayload({
      serviceId: config.serviceId,
      type: 'payment.verified',
      data: { requestId: 'req_123' },
    })).toBeNull();

    consoleErrorSpy.mockRestore();
  });
});
