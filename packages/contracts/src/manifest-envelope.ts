interface ManifestSigningMessageInput {
  kid: string;
  issuedAt: string;
  payloadDigest: string;
}

function normalizeForCanonicalJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined || typeof item === 'function' || typeof item === 'symbol'
        ? null
        : normalizeForCanonicalJson(item),
    );
  }

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((canonical, key) => {
      const item = record[key];
      if (item !== undefined && typeof item !== 'function' && typeof item !== 'symbol') {
        canonical[key] = normalizeForCanonicalJson(item);
      }
      return canonical;
    }, {});
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(normalizeForCanonicalJson(value));
}

export function buildManifestSigningMessage({
  kid,
  issuedAt,
  payloadDigest,
}: ManifestSigningMessageInput): string {
  return `apex-manifest-v1.${kid}.${issuedAt}.${payloadDigest}`;
}
