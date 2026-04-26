import { describe, expect, it } from 'vitest';
import {
  buildWebhookSigningPayload,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../../src/services/webhook-signing.js';

describe('webhook signing', () => {
  const secret = 'whsec_test_secret';
  const timestamp = '1777100000';
  const deliveryId = 'del_123';
  const body = JSON.stringify({ type: 'payment.settled' });
  const now = new Date(Number(timestamp) * 1000);

  it('builds replay-resistant signing payloads', () => {
    expect(buildWebhookSigningPayload({ timestamp, deliveryId, body })).toBe(
      `${timestamp}.${deliveryId}.${body}`,
    );
  });

  it('signs and verifies valid payloads', () => {
    const signature = signWebhookPayload({ secret, timestamp, deliveryId, body });
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(verifyWebhookSignature({
      secret,
      timestamp,
      deliveryId,
      body,
      signature,
      toleranceSeconds: 300,
      now,
    })).toBe(true);
  });

  it('rejects stale timestamps and tampered bodies', () => {
    const signature = signWebhookPayload({ secret, timestamp, deliveryId, body });
    expect(verifyWebhookSignature({
      secret,
      timestamp: String(Number(timestamp) - 301),
      deliveryId,
      body,
      signature,
      toleranceSeconds: 300,
      now,
    })).toBe(false);
    expect(verifyWebhookSignature({
      secret,
      timestamp,
      deliveryId,
      body: JSON.stringify({ type: 'payment.failed' }),
      signature,
      toleranceSeconds: 300,
      now,
    })).toBe(false);
  });
});
