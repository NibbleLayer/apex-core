import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('Health endpoint', () => {
  it('returns ok status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
