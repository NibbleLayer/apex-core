import { eq, and, desc } from 'drizzle-orm';
import {
  services,
  environments,
  walletDestinations,
  routes,
  priceRules,
  discoveryMetadata,
  serviceManifests,
} from '@nibblelayer/apex-persistence/db';
import { buildManifest, computeChecksum, hasManifestChanged } from '@nibblelayer/apex-control-plane-core';
import type { ApexManifest } from '@nibblelayer/apex-contracts';
import { createId } from '../utils/id.js';
import type { DrizzleInstance } from '../db/types.js';

export interface ManifestResult {
  manifest: ApexManifest;
  isNew: boolean;
}

interface ManifestEnvironmentState {
  id: string;
  mode: 'test' | 'prod';
  network: string;
  facilitatorUrl: string;
}

interface ManifestWalletState {
  address: string;
  token: string;
  network: string;
}

interface PersistedManifestState {
  version: number;
  checksum: string | null;
  payload: ApexManifest;
}

interface PlannedManifestMutation {
  manifest: ApexManifest;
  checksum: string;
  shouldPersist: boolean;
  isNew: boolean;
}

export function planManifestMutation(input: {
  serviceId: string;
  environment: ManifestEnvironmentState;
  wallet: ManifestWalletState;
  routeEntries: Parameters<typeof buildManifest>[0]['routes'];
  latestManifest?: PersistedManifestState;
}): PlannedManifestMutation {
  const manifest = buildManifest({
    serviceId: input.serviceId,
    environment: {
      mode: input.environment.mode,
      network: input.environment.network,
      facilitatorUrl: input.environment.facilitatorUrl,
    },
    wallet: {
      address: input.wallet.address,
      token: input.wallet.token,
      network: input.wallet.network,
    },
    routes: input.routeEntries,
    eventsEndpoint: '/events',
    idempotencyEnabled: true,
    refreshIntervalMs: 30000,
    currentVersion: input.latestManifest?.version ?? 0,
  });

  const { checksum: _checksum, version: _version, ...manifestContent } = manifest;
  const checksum = computeChecksum(manifestContent);

  if (
    input.latestManifest?.checksum &&
    !hasManifestChanged(manifestContent, input.latestManifest.checksum)
  ) {
    return {
      manifest: input.latestManifest.payload,
      checksum: input.latestManifest.checksum,
      shouldPersist: false,
      isNew: false,
    };
  }

  return {
    manifest,
    checksum,
    shouldPersist: true,
    isNew: true,
  };
}

/**
 * Generate a manifest for a service/environment combination.
 *
 * 1. Reads current state: service, environment, wallet, routes, pricing, discovery
 * 2. Builds ApexManifest using the core builder
 * 3. Checks if content changed (checksum comparison)
 * 4. If changed, persists new version to service_manifests table
 * 5. Returns manifest + isNew flag
 */
export async function generateManifest(
  db: DrizzleInstance,
  serviceId: string,
  environmentMode: 'test' | 'prod',
): Promise<ManifestResult> {
  // 1. Get service
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);

  if (!service) {
    throw new Error(`Service not found: ${serviceId}`);
  }

  // 2. Get environment for this mode
  const [environment] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.serviceId, serviceId), eq(environments.mode, environmentMode)))
    .limit(1);

  if (!environment) {
    throw new Error(`Environment not found for service ${serviceId} mode ${environmentMode}`);
  }

  // 3. Get active wallet destination for this environment
  const [wallet] = await db
    .select()
    .from(walletDestinations)
    .where(
      and(
        eq(walletDestinations.serviceId, serviceId),
        eq(walletDestinations.environmentId, environment.id),
        eq(walletDestinations.active, true),
      ),
    )
    .limit(1);

  if (!wallet) {
    throw new Error(`No active wallet destination for service ${serviceId} environment ${environmentMode}`);
  }

  // 4. Get enabled routes for this service
  const serviceRoutes = await db
    .select()
    .from(routes)
    .where(and(eq(routes.serviceId, serviceId), eq(routes.enabled, true)));

  // 5. For each route, get price rules and discovery metadata
  const routeEntries = [];
  for (const route of serviceRoutes) {
    // Get active price rules
    const rules = await db
      .select()
      .from(priceRules)
      .where(and(eq(priceRules.routeId, route.id), eq(priceRules.active, true)));

    // Get discovery metadata
    const [discovery] = await db
      .select()
      .from(discoveryMetadata)
      .where(eq(discoveryMetadata.routeId, route.id))
      .limit(1);

    routeEntries.push({
      route: {
        method: route.method,
        path: route.path,
        description: route.description,
        enabled: route.enabled,
      },
      priceRules: rules.map((r) => ({
        scheme: r.scheme as 'exact',
        amount: r.amount,
        token: r.token,
        network: r.network,
        active: r.active,
      })),
      discovery: discovery
        ? {
            discoverable: discovery.discoverable,
            category: discovery.category,
            tags: discovery.tags,
            inputSchema: discovery.inputSchema,
            outputSchema: discovery.outputSchema,
            published: discovery.published,
          }
        : null,
    });
  }

  // 6. Get latest manifest version
  const [latestManifest] = await db
    .select()
    .from(serviceManifests)
    .where(
      and(
        eq(serviceManifests.serviceId, serviceId),
        eq(serviceManifests.environmentId, environment.id),
      ),
    )
    .orderBy(desc(serviceManifests.version))
    .limit(1);

  const plannedManifest = planManifestMutation({
    serviceId,
    environment: {
      id: environment.id,
      mode: environment.mode as 'test' | 'prod',
      network: environment.network,
      facilitatorUrl: environment.facilitatorUrl,
    },
    wallet: {
      address: wallet.address,
      token: wallet.token,
      network: wallet.network,
    },
    routeEntries,
    latestManifest: latestManifest
      ? {
          version: latestManifest.version,
          checksum: latestManifest.checksum,
          payload: latestManifest.payload as unknown as ApexManifest,
        }
      : undefined,
  });

  if (plannedManifest.shouldPersist) {
    const id = createId();
    await db.insert(serviceManifests).values({
      id,
      serviceId,
      environmentId: environment.id,
      version: plannedManifest.manifest.version,
      payload: plannedManifest.manifest as unknown as Record<string, unknown>,
      checksum: plannedManifest.checksum,
    });
  }

  return {
    manifest: plannedManifest.manifest,
    isNew: plannedManifest.isNew,
  };
}
