import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { resetDbResolver, setDbResolver } from '../../src/db/resolver.js';

function createEmptyDbResolver() {
  const emptySelectChain = {
    from: () => emptySelectChain,
    where: () => emptySelectChain,
    limit: () => [],
  };

  return async () => ({
    select: () => emptySelectChain,
  } as any);
}

describe('sdk manifest route order', () => {
  afterEach(() => {
    resetDbResolver();
  });

  it('routes /sdk/manifest through SDK auth before root admin routers', async () => {
    setDbResolver(createEmptyDbResolver());

    const response = await app.request('/sdk/manifest', {
      headers: { Authorization: 'Bearer apx_sdk_invalid' },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Invalid SDK token');
    expect(body.error).not.toBe('Invalid API key');
  });
});
