import { describe, expect, it } from 'vitest';
import { buildManifest, computeChecksum, hasManifestChanged } from '../src/index.js';

const mockInput = {
  serviceId: 'svc_test123',
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
      route: { method: 'GET', path: '/api/weather', description: 'Weather data', enabled: true },
      priceRules: [
        { scheme: 'exact' as const, amount: '$0.01', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', network: 'eip155:84532', active: true },
      ],
      discovery: {
        discoverable: true,
        category: 'weather',
        tags: ['forecast', 'real-time'],
        inputSchema: null,
        outputSchema: null,
        published: true,
      },
    },
  ],
  eventsEndpoint: 'https://api.apex.nibblelayer.com/events',
  idempotencyEnabled: true,
  refreshIntervalMs: 60000,
  currentVersion: 0,
};

describe('buildManifest', () => {
  it('builds a manifest with the expected route, wallet, and version data', () => {
    const manifest = buildManifest(mockInput);

    expect(manifest.serviceId).toBe('svc_test123');
    expect(manifest.environment).toBe('test');
    expect(manifest.version).toBe(1);
    expect(manifest.routes['GET /api/weather']).toMatchObject({
      description: 'Weather data',
      accepts: [
        {
          scheme: 'exact',
          price: '$0.01',
          network: 'eip155:84532',
          payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
        },
      ],
      extensions: {
        'payment-identifier': { required: false },
        bazaar: {
          discoverable: true,
          category: 'weather',
          tags: ['forecast', 'real-time'],
        },
      },
    });
  });

  it('filters out disabled routes and routes without active price rules', () => {
    const manifest = buildManifest({
      ...mockInput,
      routes: [
        {
          route: { method: 'GET', path: '/disabled', description: null, enabled: false },
          priceRules: [
            { scheme: 'exact' as const, amount: '$0.01', token: '0x833', network: 'eip155:84532', active: true },
          ],
          discovery: null,
        },
        {
          route: { method: 'GET', path: '/inactive', description: null, enabled: true },
          priceRules: [
            { scheme: 'exact' as const, amount: '$0.01', token: '0x833', network: 'eip155:84532', active: false },
          ],
          discovery: null,
        },
      ],
    });

    expect(manifest.routes).toEqual({});
  });

  it('omits bazaar extension when discovery is not published', () => {
    const manifest = buildManifest({
      ...mockInput,
      routes: [
        {
          route: { method: 'GET', path: '/api/unpublished', description: null, enabled: true },
          priceRules: [
            { scheme: 'exact' as const, amount: '$0.01', token: '0x833', network: 'eip155:84532', active: true },
          ],
          discovery: {
            discoverable: true,
            category: 'test',
            tags: null,
            inputSchema: null,
            outputSchema: null,
            published: false,
          },
        },
      ],
    });

    expect(manifest.routes['GET /api/unpublished'].extensions?.bazaar).toBeUndefined();
    expect(manifest.routes['GET /api/unpublished'].extensions?.['payment-identifier']).toEqual({ required: false });
  });
});

describe('checksum helpers', () => {
  it('produces deterministic sha256 checksums', () => {
    const manifest = buildManifest(mockInput);
    const { checksum: _checksum, ...payload } = manifest;

    expect(computeChecksum(payload)).toMatch(/^[a-f0-9]{64}$/);
    expect(computeChecksum(payload)).toBe(computeChecksum(payload));
  });

  it('detects payload changes', () => {
    const manifest = buildManifest(mockInput);
    const { checksum, ...payload } = manifest;

    expect(hasManifestChanged(payload, checksum)).toBe(false);
    expect(hasManifestChanged({ ...payload, version: 999 }, checksum)).toBe(true);
  });
});
