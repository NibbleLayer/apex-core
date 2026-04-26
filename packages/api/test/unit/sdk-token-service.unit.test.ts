import { describe, expect, it } from 'vitest';
import {
  generateSdkToken,
  hashToken,
  hasScope,
  isExpired,
} from '../../src/services/sdk-token-service.js';

describe('sdk-token-service', () => {
  it('generates prefixed SDK tokens and stores only sha256 hashes', () => {
    const generated = generateSdkToken();

    expect(generated.rawToken).toMatch(/^apx_sdk_[a-f0-9]{64}$/);
    expect(generated.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.keyHash).toBe(hashToken(generated.rawToken));
    expect(generated.keyHash).not.toContain(generated.rawToken);
  });

  it('hashes tokens deterministically', () => {
    expect(hashToken('apx_sdk_test')).toBe(hashToken('apx_sdk_test'));
    expect(hashToken('apx_sdk_test')).not.toBe(hashToken('apx_sdk_other'));
  });

  it('checks scopes exactly', () => {
    expect(hasScope(['manifest:read', 'events:write'], 'manifest:read')).toBe(true);
    expect(hasScope(['events:write'], 'manifest:read')).toBe(false);
  });

  it('treats null expiry as active and past expiry as expired', () => {
    const now = new Date('2026-04-24T00:00:00.000Z');

    expect(isExpired(null, now)).toBe(false);
    expect(isExpired(undefined, now)).toBe(false);
    expect(isExpired(new Date('2026-04-23T23:59:59.999Z'), now)).toBe(true);
    expect(isExpired(new Date('2026-04-24T00:00:00.001Z'), now)).toBe(false);
    expect(isExpired(now, now)).toBe(true);
  });
});
