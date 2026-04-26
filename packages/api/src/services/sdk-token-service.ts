import crypto from 'node:crypto';

const SDK_TOKEN_PREFIX = 'apx_sdk_';

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateSdkToken(): { rawToken: string; keyHash: string } {
  const rawToken = `${SDK_TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
  return { rawToken, keyHash: hashToken(rawToken) };
}

export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required);
}

export function isExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  return expiresAt ? expiresAt.getTime() <= now.getTime() : false;
}

export { SDK_TOKEN_PREFIX };
