import { describe, expect, it, vi } from 'vitest';
import {
  buildDnsProofRecord,
  normalizeDomain,
  verifyDnsTxtProof,
} from '../../src/services/domain-verification-service.js';

describe('domain verification service', () => {
  it('normalizes domains from URLs and trims path/trailing dots', () => {
    expect(normalizeDomain(' HTTPS://Weather.Example.COM/path?q=1 ')).toBe('weather.example.com');
    expect(normalizeDomain('Weather.Example.COM.')).toBe('weather.example.com');
  });

  it.each(['', 'localhost', '127.0.0.1', 'bad_domain', 'example..com'])('rejects invalid domain %s', (input) => {
    expect(() => normalizeDomain(input)).toThrow();
  });

  it('builds the expected DNS proof record', () => {
    expect(buildDnsProofRecord('weather.example.com', 'tok_123')).toEqual({
      name: '_apex.weather.example.com',
      value: 'apex-verify=tok_123',
    });
  });

  it('verifies an exact TXT value across DNS chunks', async () => {
    const resolveTxt = vi.fn().mockResolvedValue([['other'], ['apex-verify=', 'tok_123']]);

    await expect(verifyDnsTxtProof({ domain: 'weather.example.com', token: 'tok_123', resolveTxt })).resolves.toMatchObject({
      success: true,
      name: '_apex.weather.example.com',
      value: 'apex-verify=tok_123',
    });
  });

  it('returns a structured failure for missing TXT records', async () => {
    const error = Object.assign(new Error('not found'), { code: 'ENODATA' });
    const result = await verifyDnsTxtProof({
      domain: 'weather.example.com',
      token: 'tok_123',
      resolveTxt: vi.fn().mockRejectedValue(error),
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('not found');
  });
});
