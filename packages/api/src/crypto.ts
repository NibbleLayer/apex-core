import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * Hash an API key using scrypt (memory-hard KDF).
 * Returns a string in format: $scrypt$N=16384$r=8$p=1$<base64-salt>$<base64-key>
 */
export async function hashApiKey(rawKey: string): Promise<string> {
  const salt = randomBytes(32);
  const keylen = 64;
  const N = 16384;
  const r = 8;
  const p = 1;

  const derivedKey = await scryptAsync(rawKey, salt, keylen, { N, r, p }) as Buffer;

  return `$scrypt$N=${N}$r=${r}$p=${p}$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

/**
 * Verify a raw API key against a stored scrypt hash.
 * Uses constant-time comparison.
 */
export async function verifyApiKey(rawKey: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 7 || parts[1] !== 'scrypt') {
    return false;
  }

  const N = parseInt(parts[2].split('=')[1], 10);
  const r = parseInt(parts[3].split('=')[1], 10);
  const p = parseInt(parts[4].split('=')[1], 10);
  const salt = Buffer.from(parts[5], 'base64');
  const expectedKey = Buffer.from(parts[6], 'base64');

  const derivedKey = await scryptAsync(rawKey, salt, expectedKey.length, { N, r, p }) as Buffer;

  return timingSafeEqual(derivedKey, expectedKey);
}
