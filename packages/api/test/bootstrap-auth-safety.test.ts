import { afterEach, describe, expect, it, vi } from 'vitest';
import { testDb } from './setup.js';

const BOOTSTRAP_TOGGLE = 'ALLOW_UNAUTHENTICATED_ORGANIZATION_BOOTSTRAP';

async function loadOrganizationRoutes() {
  vi.resetModules();

  const resolver = await import('../src/db/resolver.js');
  resolver.setDbResolver(async () => testDb);

  const routes = await import('../src/routes/organizations.js');

  return {
    organizationRoutes: routes.organizationRoutes,
    resetDbResolver: resolver.resetDbResolver,
  };
}

afterEach(() => {
  delete process.env[BOOTSTRAP_TOGGLE];
  vi.resetModules();
});

describe('bootstrap organization creation safety', () => {
  it('blocks unauthenticated POST /organizations by default', async () => {
    delete process.env[BOOTSTRAP_TOGGLE];

    const { organizationRoutes, resetDbResolver } = await loadOrganizationRoutes();

    try {
      const response = await organizationRoutes.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bootstrap Org',
          slug: 'bootstrap-org',
        }),
      });

      expect(response.status).toBe(401);
    } finally {
      resetDbResolver();
    }
  });

  it(`allows unauthenticated POST /organizations only when ${BOOTSTRAP_TOGGLE}=true`, async () => {
    process.env[BOOTSTRAP_TOGGLE] = 'true';

    const { organizationRoutes, resetDbResolver } = await loadOrganizationRoutes();

    try {
      const response = await organizationRoutes.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bootstrap Dev Org',
          slug: 'bootstrap-dev-org',
        }),
      });

      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.name).toBe('Bootstrap Dev Org');
      expect(body.slug).toBe('bootstrap-dev-org');
      expect(body.id).toBeDefined();
    } finally {
      resetDbResolver();
    }
  });
});
