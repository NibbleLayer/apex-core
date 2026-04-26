import crypto from 'node:crypto';
import {
  buildManifestSigningMessage,
  canonicalizeJson,
  type ApexManifest,
  type SignedManifestEnvelope,
} from '@nibblelayer/apex-contracts';

interface SignManifestEnvelopeInput {
  manifest: ApexManifest;
  rawApiKey: string;
  keyId: string;
  now?: Date;
  ttlSeconds?: number;
}

export function deriveManifestSigningSecret(rawApiKey: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`apex-manifest-signing:${rawApiKey}`)
    .digest();
}

// Transitional Gate 1 signing: derive an HMAC key from the existing Bearer API key.
// Future slices should replace this with scoped SDK tokens and/or asymmetric signing.

function computeManifestPayloadDigest(manifest: ApexManifest): string {
  return crypto
    .createHash('sha256')
    .update(canonicalizeJson(manifest))
    .digest('hex');
}

export function signManifestEnvelope({
  manifest,
  rawApiKey,
  keyId,
  now = new Date(),
  ttlSeconds = 300,
}: SignManifestEnvelopeInput): SignedManifestEnvelope {
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const payloadDigest = computeManifestPayloadDigest(manifest);
  const message = buildManifestSigningMessage({ kid: keyId, issuedAt, payloadDigest });
  const value = crypto
    .createHmac('sha256', deriveManifestSigningSecret(rawApiKey))
    .update(message)
    .digest('hex');

  return {
    manifest,
    signature: {
      alg: 'HS256',
      kid: keyId,
      issuedAt,
      expiresAt,
      payloadDigest,
      value,
    },
  };
}

export function verifyManifestEnvelope({
  envelope,
  rawApiKey,
}: {
  envelope: SignedManifestEnvelope;
  rawApiKey: string;
}): boolean {
  const payloadDigest = computeManifestPayloadDigest(envelope.manifest);
  if (payloadDigest !== envelope.signature.payloadDigest) {
    return false;
  }

  const message = buildManifestSigningMessage({
    kid: envelope.signature.kid,
    issuedAt: envelope.signature.issuedAt,
    payloadDigest,
  });
  const expected = crypto
    .createHmac('sha256', deriveManifestSigningSecret(rawApiKey))
    .update(message)
    .digest('hex');

  const expectedBytes = Buffer.from(expected, 'hex');
  const actualBytes = Buffer.from(envelope.signature.value, 'hex');

  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(expectedBytes, actualBytes);
}
