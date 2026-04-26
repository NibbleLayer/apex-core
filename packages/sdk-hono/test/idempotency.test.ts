import { describe, it, expect } from 'vitest';
import { applyIdempotency } from '../src/idempotency.js';
import type { ApexManifest } from '@nibblelayer/apex-contracts';

const baseManifest: ApexManifest = {
  serviceId: 'svc_test123',
  environment: 'test',
  version: 1,
  network: 'eip155:84532',
  facilitatorUrl: 'https://x402.org/facilitator',
  wallet: {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    network: 'eip155:84532',
  },
  verifiedDomains: [],
  routes: {
    'GET /api/weather': {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.01',
          network: 'eip155:84532',
          payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
        },
      ],
      description: 'Weather data',
    },
    'POST /api/forecast': {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.05',
          network: 'eip155:84532',
          payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
        },
      ],
    },
  },
  eventsEndpoint: 'https://api.apex.nibblelayer.com/events',
  idempotencyEnabled: false,
  refreshIntervalMs: 60000,
  checksum: 'abc123',
};

describe('applyIdempotency', () => {
  it('adds payment-identifier extension when idempotencyEnabled is true', () => {
    const manifest: ApexManifest = {
      ...baseManifest,
      idempotencyEnabled: true,
    };

    const result = applyIdempotency(manifest);

    for (const route of Object.values(result.routes)) {
      expect(route.extensions).toBeDefined();
      expect(route.extensions!['payment-identifier']).toEqual({
        required: false,
      });
    }
  });

  it('declares payment-identifier as required=false', () => {
    const manifest: ApexManifest = {
      ...baseManifest,
      idempotencyEnabled: true,
    };

    const result = applyIdempotency(manifest);
    const weatherRoute = result.routes['GET /api/weather'];

    expect(weatherRoute.extensions!['payment-identifier']).toEqual({
      required: false,
    });
  });

  it('preserves existing extensions when adding payment-identifier', () => {
    const manifest: ApexManifest = {
      ...baseManifest,
      idempotencyEnabled: true,
      routes: {
        'GET /api/weather': {
          accepts: [
            {
              scheme: 'exact',
              price: '$0.01',
              network: 'eip155:84532',
              payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
            },
          ],
          extensions: {
            bazaar: {
              discoverable: true,
              category: 'weather',
              tags: ['api', 'forecast'],
            },
          },
        },
      },
    };

    const result = applyIdempotency(manifest);
    const route = result.routes['GET /api/weather'];

    expect(route.extensions!['payment-identifier']).toEqual({
      required: false,
    });
    // Existing extension preserved
    expect(route.extensions!.bazaar).toEqual({
      discoverable: true,
      category: 'weather',
      tags: ['api', 'forecast'],
    });
  });

  it('does not add extensions when idempotencyEnabled is false', () => {
    const manifest: ApexManifest = {
      ...baseManifest,
      idempotencyEnabled: false,
    };

    const result = applyIdempotency(manifest);

    for (const route of Object.values(result.routes)) {
      expect(route.extensions).toBeUndefined();
    }
  });

  it('does not modify the original manifest (immutable)', () => {
    const manifest: ApexManifest = {
      ...baseManifest,
      idempotencyEnabled: true,
    };

    const originalRoutes = JSON.stringify(manifest.routes);
    applyIdempotency(manifest);

    // Original manifest routes are unchanged
    expect(JSON.stringify(manifest.routes)).toBe(originalRoutes);
  });
});
