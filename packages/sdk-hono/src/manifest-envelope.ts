import crypto from 'node:crypto';
import {
  buildManifestSigningMessage,
  canonicalizeJson,
  type SignedManifestEnvelope,
} from '@nibblelayer/apex-contracts';

function deriveManifestSigningSecret(rawApiKey: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`apex-manifest-signing:${rawApiKey}`)
    .digest();
}

function computePayloadDigest(envelope: SignedManifestEnvelope): string {
  return crypto
    .createHash('sha256')
    .update(canonicalizeJson(envelope.manifest))
    .digest('hex');
}

export function verifySignedManifestEnvelope({
  envelope,
  apiKey,
}: {
  envelope: SignedManifestEnvelope;
  apiKey: string;
}): boolean {
  const payloadDigest = computePayloadDigest(envelope);
  if (payloadDigest !== envelope.signature.payloadDigest) {
    return false;
  }

  const message = buildManifestSigningMessage({
    kid: envelope.signature.kid,
    issuedAt: envelope.signature.issuedAt,
    payloadDigest,
  });
  const expected = crypto
    .createHmac('sha256', deriveManifestSigningSecret(apiKey))
    .update(message)
    .digest('hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  const actualBytes = Buffer.from(envelope.signature.value, 'hex');

  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}
