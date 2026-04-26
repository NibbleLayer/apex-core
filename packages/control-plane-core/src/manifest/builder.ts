import crypto from 'node:crypto';
import type {
  ApexManifest,
  DiscoveryMetadata,
  Environment,
  ManifestRoute,
  ManifestRouteAccepts,
  ManifestRouteExtensions,
  ManifestWallet,
  PriceRule,
  Route,
  WalletDestination,
} from '@nibblelayer/apex-contracts';

export interface ManifestInput {
  serviceId: string;
  environment: Pick<Environment, 'mode' | 'network' | 'facilitatorUrl'>;
  wallet: Pick<WalletDestination, 'address' | 'token' | 'network'>;
  verifiedDomains?: string[];
  routes: Array<{
    route: Pick<Route, 'id' | 'method' | 'path' | 'description' | 'enabled'>;
    priceRules: Array<Pick<PriceRule, 'scheme' | 'amount' | 'token' | 'network' | 'active'>>;
    discovery: Pick<DiscoveryMetadata, 'discoverable' | 'category' | 'tags' | 'inputSchema' | 'outputSchema' | 'published'> | null;
  }>;
  eventsEndpoint: string;
  idempotencyEnabled: boolean;
  refreshIntervalMs: number;
  currentVersion: number;
}

export function buildManifest(input: ManifestInput): ApexManifest {
  const routes: Record<string, ManifestRoute> = {};

  for (const entry of input.routes) {
    if (!entry.route.enabled) continue;

    const activeRules = entry.priceRules.filter((rule) => rule.active);
    if (activeRules.length === 0) continue;

    const key = `${entry.route.method} ${entry.route.path}`;
    const accepts: ManifestRouteAccepts[] = activeRules.map((rule) => ({
      scheme: rule.scheme,
      price: rule.amount,
      network: rule.network,
      payTo: input.wallet.address,
    }));

    const extensions: ManifestRouteExtensions = {
      apex: {
        routeId: entry.route.id,
        routeKey: key,
      },
    };

    if (input.idempotencyEnabled) {
      extensions['payment-identifier'] = { required: false };
    }

    if (entry.discovery?.discoverable && entry.discovery.published) {
      extensions.bazaar = {
        discoverable: true,
        category: entry.discovery.category ?? undefined,
        tags: entry.discovery.tags ?? undefined,
        inputSchema: entry.discovery.inputSchema ?? undefined,
        outputSchema: entry.discovery.outputSchema ?? undefined,
      };
    }

    routes[key] = {
      accepts,
      ...(entry.route.description && { description: entry.route.description }),
      extensions,
    };
  }

  const wallet: ManifestWallet = {
    address: input.wallet.address,
    token: input.wallet.token,
    network: input.wallet.network,
  };

  const manifestWithoutChecksum = {
    serviceId: input.serviceId,
    environment: input.environment.mode,
    version: input.currentVersion + 1,
    network: input.environment.network,
    facilitatorUrl: input.environment.facilitatorUrl,
    wallet,
    verifiedDomains: [...(input.verifiedDomains ?? [])].sort(),
    routes,
    eventsEndpoint: input.eventsEndpoint,
    idempotencyEnabled: input.idempotencyEnabled,
    refreshIntervalMs: input.refreshIntervalMs,
  };

  return {
    ...manifestWithoutChecksum,
    checksum: computeChecksum(manifestWithoutChecksum),
  };
}

export function computeChecksum(payload: unknown): string {
  const canonical = JSON.stringify(sortKeysDeep(payload));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function hasManifestChanged(payload: unknown, previousChecksum: string): boolean {
  return computeChecksum(payload) !== previousChecksum;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }

  return value;
}
