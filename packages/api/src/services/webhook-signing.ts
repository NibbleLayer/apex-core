import crypto from 'node:crypto';

export function buildWebhookSigningPayload(input: {
  timestamp: string | number;
  deliveryId: string;
  body: string;
}): string {
  return `${input.timestamp}.${input.deliveryId}.${input.body}`;
}

export function signWebhookPayload(input: {
  secret: string;
  timestamp: string | number;
  deliveryId: string;
  body: string;
}): string {
  const payload = buildWebhookSigningPayload(input);
  const digest = crypto.createHmac('sha256', input.secret).update(payload).digest('hex');
  return `sha256=${digest}`;
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string | number;
  deliveryId: string;
  body: string;
  signature: string;
  toleranceSeconds: number;
  now?: Date;
}): boolean {
  const timestampSeconds = typeof input.timestamp === 'number'
    ? input.timestamp
    : Number.parseInt(input.timestamp, 10);

  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > input.toleranceSeconds) {
    return false;
  }

  const expected = signWebhookPayload(input);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
