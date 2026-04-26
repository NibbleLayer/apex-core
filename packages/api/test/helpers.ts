import crypto from 'node:crypto';
import { organizations, apiKeys, services, environments, walletDestinations, routes, priceRules, sdkTokens } from '@nibblelayer/apex-persistence/db';
import { testDb } from './setup.js';
import { createId } from '../src/utils/id.js';
import { hashApiKey } from '../src/crypto.js';

/**
 * Create a test organization and return its ID.
 */
export async function createTestOrg() {
  const id = createId();
  const now = new Date();
  await testDb.insert(organizations).values({
    id,
    name: 'Test Org',
    slug: `test-org-${id.slice(0, 8)}`,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * Create a test API key for the given organization.
 * Returns the raw key (for Authorization headers) and the key ID.
 */
export async function createTestApiKey(orgId: string, label = 'Test Key') {
  const rawKey = `apex_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);
  const id = createId();
  const now = new Date();
  await testDb.insert(apiKeys).values({
    id,
    organizationId: orgId,
    keyHash,
    keyPrefix,
    label,
    createdAt: now,
    revokedAt: null,
    lastUsedAt: null,
  });
  return { rawKey, id };
}

export async function createTestSdkToken({
  orgId,
  serviceId,
  environment = 'test',
  scopes = ['manifest:read'],
}: {
  orgId: string;
  serviceId: string;
  environment?: 'test' | 'prod';
  scopes?: string[];
}) {
  const rawToken = `apx_sdk_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const id = createId();
  await testDb.insert(sdkTokens).values({
    id,
    organizationId: orgId,
    serviceId,
    environmentMode: environment,
    keyHash,
    label: 'Test SDK token',
    scopes,
    revokedAt: null,
    lastUsedAt: null,
  });
  return { rawToken, id };
}

/**
 * Create a test service under the given organization.
 */
export async function createTestService(orgId: string, name = 'Test Service') {
  const id = createId();
  const now = new Date();
  await testDb.insert(services).values({
    id,
    organizationId: orgId,
    name,
    slug: `test-svc-${id.slice(0, 8)}`,
    description: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * Create a test environment under the given service.
 */
export async function createTestEnvironment(
  serviceId: string,
  mode: 'test' | 'prod' = 'test',
  network = 'eip155:84532',
) {
  const id = createId();
  const now = new Date();
  const facilitatorUrl =
    mode === 'test'
      ? 'https://x402.org/facilitator'
      : 'https://api.cdp.coinbase.com/platform/v2/x402';
  await testDb.insert(environments).values({
    id,
    serviceId,
    mode,
    network,
    facilitatorUrl,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * Create a test wallet destination.
 */
export async function createTestWallet(
  serviceId: string,
  environmentId: string,
  network = 'eip155:84532',
) {
  const id = createId();
  await testDb.insert(walletDestinations).values({
    id,
    serviceId,
    environmentId,
    address: '0x1234567890abcdef1234567890abcdef12345678',
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    network,
    label: 'Test wallet',
    active: true,
  });
  return id;
}

/**
 * Create a test route under the given service.
 */
export async function createTestRoute(
  serviceId: string,
  method = 'GET' as const,
  path = '/api/test',
) {
  const id = createId();
  await testDb.insert(routes).values({
    id,
    serviceId,
    method,
    path,
    description: 'Test route',
    enabled: true,
  });
  return id;
}

/**
 * Create a test price rule for a route.
 */
export async function createTestPriceRule(
  routeId: string,
  amount = '$0.01',
  network = 'eip155:84532',
) {
  const id = createId();
  await testDb.insert(priceRules).values({
    id,
    routeId,
    scheme: 'exact',
    amount,
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    network,
    active: true,
  });
  return id;
}

/**
 * Convenience: create org + API key in one call.
 * Returns orgId and rawKey for auth headers.
 */
export async function createTestOrgWithKey(label = 'Test Key') {
  const orgId = await createTestOrg();
  const { rawKey, id: keyId } = await createTestApiKey(orgId, label);
  return { orgId, keyId, rawKey };
}

/**
 * Convenience: create org + key + service.
 */
export async function createTestOrgKeyAndService(serviceName = 'Test Service') {
  const { orgId, keyId, rawKey } = await createTestOrgWithKey();
  const serviceId = await createTestService(orgId, serviceName);
  return { orgId, keyId, rawKey, serviceId };
}

/**
 * Build Authorization headers for a raw API key.
 */
export function authHeaders(rawKey: string) {
  return { Authorization: `Bearer ${rawKey}` };
}

/**
 * Build JSON request headers with Authorization.
 */
export function jsonAuthHeaders(rawKey: string) {
  return {
    Authorization: `Bearer ${rawKey}`,
    'Content-Type': 'application/json',
  };
}
