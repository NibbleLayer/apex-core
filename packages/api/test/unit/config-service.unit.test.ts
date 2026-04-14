import { describe, expect, it } from 'vitest';
import { planManifestMutation } from '../../src/services/config-service.js';

const routeEntries = [
  {
    route: {
      method: 'GET' as const,
      path: '/weather',
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
];

function createInput() {
  return {
    serviceId: 'svc_123',
    environment: {
      id: 'env_123',
      mode: 'test' as const,
      network: 'eip155:84532',
      facilitatorUrl: 'https://x402.org/facilitator',
    },
    wallet: {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
    },
    routeEntries,
  };
}

describe('planManifestMutation', () => {
  it('plans a new manifest when no previous version exists', () => {
    const result = planManifestMutation(createInput());

    expect(result.shouldPersist).toBe(true);
    expect(result.isNew).toBe(true);
    expect(result.manifest.version).toBe(1);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('reuses the stored manifest when the content checksum is unchanged', () => {
    const firstPass = planManifestMutation(createInput());
    const secondPass = planManifestMutation({
      ...createInput(),
      latestManifest: {
        version: firstPass.manifest.version,
        checksum: firstPass.checksum,
        payload: firstPass.manifest,
      },
    });

    expect(secondPass.shouldPersist).toBe(false);
    expect(secondPass.isNew).toBe(false);
    expect(secondPass.manifest).toEqual(firstPass.manifest);
  });

  it('increments the manifest version when route state changes', () => {
    const firstPass = planManifestMutation(createInput());
    const secondPass = planManifestMutation({
      ...createInput(),
      routeEntries: [
        {
          ...routeEntries[0],
          priceRules: [{ ...routeEntries[0].priceRules[0], amount: '$0.05' }],
        },
      ],
      latestManifest: {
        version: firstPass.manifest.version,
        checksum: firstPass.checksum,
        payload: firstPass.manifest,
      },
    });

    expect(secondPass.shouldPersist).toBe(true);
    expect(secondPass.manifest.version).toBe(2);
    expect(secondPass.manifest.routes['GET /weather'].accepts[0].price).toBe('$0.05');
  });
});
