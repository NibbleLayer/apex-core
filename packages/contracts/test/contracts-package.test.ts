import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as contracts from '../src/index.js';
import * as schemas from '../src/schemas/index.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(testDir, '../package.json');

describe('@nibblelayer/apex-contracts public surface', () => {
  it('exports the approved public-safe contract models and schemas', () => {
    expect(contracts.apexManifestSchema).toBeDefined();
    expect(contracts.paymentEventPayloadSchema).toBeDefined();
    expect(contracts.paymentEventTypeSchema).toBeDefined();
    expect(contracts.createOrganizationSchema).toBeDefined();
    expect(contracts.createServiceSchema).toBeDefined();
    expect(contracts.createEnvironmentSchema).toBeDefined();
    expect(contracts.createWalletSchema).toBeDefined();
    expect(contracts.createRouteSchema).toBeDefined();
    expect(contracts.createPriceRuleSchema).toBeDefined();
    expect(contracts.createDiscoverySchema).toBeDefined();
    expect(contracts.createServiceDomainSchema).toBeDefined();
    expect(contracts.serviceDomainSchema).toBeDefined();
    expect(contracts.createWebhookSchema).toBeDefined();
    expect(contracts.settlementSchema).toBeDefined();
    expect(contracts.manifestSignatureSchema).toBeDefined();
    expect(contracts.signedManifestEnvelopeSchema).toBeDefined();
    expect(contracts.canonicalizeJson).toBeDefined();
    expect(contracts.buildManifestSigningMessage).toBeDefined();
  });

  it('canonicalizes JSON with stable sorted object keys', () => {
    expect(
      contracts.canonicalizeJson({ b: 2, a: { d: 4, c: 3 }, list: [{ y: true, x: false }] }),
    ).toBe(
      contracts.canonicalizeJson({ list: [{ x: false, y: true }], a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it('validates a signed manifest envelope shape', () => {
    const manifest = {
      serviceId: 'svc_123',
      environment: 'test',
      version: 1,
      network: 'eip155:84532',
      facilitatorUrl: 'https://x402.org/facilitator',
      wallet: {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'eip155:84532',
      },
      verifiedDomains: ['weather.example.com'],
      routes: {},
      eventsEndpoint: '/events',
      idempotencyEnabled: true,
      refreshIntervalMs: 60000,
      checksum: 'abc123',
    };

    expect(
      contracts.signedManifestEnvelopeSchema.safeParse({
        manifest,
        signature: {
          alg: 'HS256',
          kid: 'key_123',
          issuedAt: '2026-04-24T00:00:00.000Z',
          expiresAt: '2026-04-24T00:05:00.000Z',
          payloadDigest: 'a'.repeat(64),
          value: 'b'.repeat(64),
        },
      }).success,
    ).toBe(true);
  });

  it('defines the root and ./schemas package exports', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      exports: Record<string, unknown>;
    };

    expect(packageJson.exports['.']).toBeDefined();
    expect(packageJson.exports['./schemas']).toBeDefined();
    expect(schemas.apexManifestSchema).toBeDefined();
    expect(schemas.paymentEventPayloadSchema).toBeDefined();
  });

  it('does not export excluded secret-bearing or internal helper surfaces', () => {
    expect(contracts).not.toHaveProperty('ApiKey');
    expect(contracts).not.toHaveProperty('WebhookEndpoint');
    expect(contracts).not.toHaveProperty('createApiKeySchema');
    expect(contracts).not.toHaveProperty('apiKeySchema');
    expect(contracts).not.toHaveProperty('webhookSchema');
    expect(contracts).not.toHaveProperty('buildManifest');
    expect(contracts).not.toHaveProperty('computeChecksum');
    expect(contracts).not.toHaveProperty('hasManifestChanged');
  });
});
