import crypto from 'node:crypto';

export function createId(): string {
  return `c${crypto.randomBytes(16).toString('hex').slice(0, 24)}`;
}
