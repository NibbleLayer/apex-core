import { describe, expect, it } from 'vitest';
import { apexManifestSchema } from '@nibblelayer/apex-contracts/schemas';
import { buildManifest } from '../src/index.js';

const manifestInput = {
  serviceId: 'svc_alignment',
  environment: {
    mode: 'test' as const,
    network: 'eip155:84532',
    facilitatorUrl: 'https://x402.org/facilitator',
  },
  wallet: {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    network: 'eip155:84532',
  },
  routes: [
    {
      route: {
        id: 'route_weather',
        method: 'GET' as const,
        path: '/api/weather',
        description: 'Weather data',
        enabled: true,
      },
      priceRules: [
        {
          scheme: 'exact' as const,
          amount: '$0.01',
          token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          network: 'eip155:84532',
          active: true,
        },
      ],
      discovery: null,
    },
  ],
  eventsEndpoint: '/events',
  idempotencyEnabled: true,
  refreshIntervalMs: 30_000,
  currentVersion: 0,
};

describe('buildManifest alignment', () => {
  it('accepts and propagates a root-relative event ingestion endpoint', () => {
    const manifest = buildManifest(manifestInput);

    expect(manifest.eventsEndpoint).toBe('/events');
  });

  it('keeps the aligned manifest valid against the contracts schema', () => {
    const manifest = buildManifest(manifestInput);

    expect(() => apexManifestSchema.parse(manifest)).not.toThrow();
  });

  it('includes stable Apex route identity in route extensions', () => {
    const manifest = buildManifest(manifestInput);

    expect(manifest.routes['GET /api/weather'].extensions?.apex).toEqual({
      routeId: 'route_weather',
      routeKey: 'GET /api/weather',
    });
  });
});
