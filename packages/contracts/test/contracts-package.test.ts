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
    expect(contracts.createWebhookSchema).toBeDefined();
    expect(contracts.settlementSchema).toBeDefined();
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
