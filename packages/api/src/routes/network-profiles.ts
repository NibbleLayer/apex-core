import { Hono } from 'hono';
import { getNetworkRegistry } from '../network/registry.js';

/**
 * Network Profiles endpoint — lists available network profiles.
 *
 * Public endpoint. No authentication required. Only returns metadata,
 * not sensitive configuration values.
 */
const profiles = new Hono();

profiles.get('/network-profiles', (c) => {
  const registry = getNetworkRegistry();
  const allProfiles = registry
    .listAll()
    .filter((p) => !p.isDeprecated)
    .map((p) => ({
      id: p.id,
      chainFamily: p.chainFamily,
      displayName: p.displayName,
      description: p.description,
      caip2: p.caip2,
      mode: p.mode,
      defaultFacilitatorUrl: p.defaultFacilitatorUrl,
      defaultAssets: p.defaultAssets,
      explorerBaseUrl: p.explorerBaseUrl,
    }));

  return c.json(allProfiles);
});

export const networkProfileRoutes = profiles;
