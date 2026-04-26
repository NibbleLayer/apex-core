import type { ApexManifest } from '@nibblelayer/apex-contracts';

export const mockManifest: ApexManifest = {
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
      extensions: {
        'payment-identifier': { required: false },
      },
    },
  },
  eventsEndpoint: 'https://api.apex.nibblelayer.com/events',
  idempotencyEnabled: true,
  refreshIntervalMs: 60000,
  checksum: 'abc123',
};

export const mockManifestV2: ApexManifest = {
  ...mockManifest,
  version: 2,
  routes: {
    'GET /api/weather': {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.02',
          network: 'eip155:84532',
          payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
        },
      ],
      description: 'Weather data (updated pricing)',
      extensions: {
        'payment-identifier': { required: false },
      },
    },
  },
  checksum: 'def456',
};
