import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { walletRoutes } from '../src/routes/wallets.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  createTestEnvironment,
  jsonAuthHeaders,
  authHeaders,
} from './helpers.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

describe('POST /services/:serviceId/wallets', () => {
  it('creates a wallet destination', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId, 'test', 'eip155:84532');

    const res = await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: envId,
        address: '0x1234567890abcdef1234567890abcdef12345678',
        token: 'native',
        network: 'eip155:84532',
        label: 'Main Wallet',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.serviceId).toBe(serviceId);
    expect(body.environmentId).toBe(envId);
    expect(body.address).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(body.token).toBe('native');
    expect(body.network).toBe('eip155:84532');
    expect(body.label).toBe('Main Wallet');
    expect(body.active).toBe(true);
  });

  it('creates a wallet without a label', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId, 'test', 'eip155:84532');

    const res = await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: envId,
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        token: 'native',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.label).toBeNull();
  });

  it('rejects network mismatch with environment', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    // Environment uses eip155:84532 (Base Sepolia)
    const envId = await createTestEnvironment(serviceId, 'test', 'eip155:84532');

    const res = await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: envId,
        address: '0x1234567890abcdef1234567890abcdef12345678',
        token: 'native',
        network: 'eip155:1', // Wrong network (Ethereum mainnet)
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('network');
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();
    const fakeServiceId = 'c_nonexistent_service_id';

    const res = await walletRoutes.request(`/services/${fakeServiceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: 'c_fake_env',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        token: 'native',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent environment', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: 'c_nonexistent_environment_id',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        token: 'native',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(404);
  });

  it('rejects invalid input (missing address)', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);

    const res = await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: envId,
        // address missing
        token: 'native',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects invalid CAIP-2 network', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);

    const res = await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: envId,
        address: '0x1234567890abcdef1234567890abcdef12345678',
        token: 'native',
        network: 'not-a-caip2',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 401 without authentication', async () => {
    const res = await walletRoutes.request('/services/fake/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        environmentId: 'fake',
        address: '0x1234',
        token: 'native',
        network: 'eip155:84532',
      }),
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /services/:serviceId/wallets', () => {
  it('returns wallets for a service', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const envId = await createTestEnvironment(serviceId);

    // Create two wallets
    await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: envId,
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        token: 'native',
        network: 'eip155:84532',
        label: 'Wallet A',
      }),
    });

    await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: envId,
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        token: '0xusdc_contract_address',
        network: 'eip155:84532',
        label: 'Wallet B',
      }),
    });

    const res = await walletRoutes.request(`/services/${serviceId}/wallets`, {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('filters wallets by environment_id', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const testEnvId = await createTestEnvironment(serviceId, 'test', 'eip155:84532');
    const prodEnvId = await createTestEnvironment(serviceId, 'prod', 'eip155:8453');

    // Create wallet in test env
    await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: testEnvId,
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        token: 'native',
        network: 'eip155:84532',
      }),
    });

    // Create wallet in prod env
    await walletRoutes.request(`/services/${serviceId}/wallets`, {
      method: 'POST',
      headers: jsonAuthHeaders(rawKey),
      body: JSON.stringify({
        environmentId: prodEnvId,
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        token: 'native',
        network: 'eip155:8453',
      }),
    });

    // Filter by test env
    const res = await walletRoutes.request(
      `/services/${serviceId}/wallets?environment_id=${testEnvId}`,
      { headers: authHeaders(rawKey) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].environmentId).toBe(testEnvId);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await walletRoutes.request('/services/c_nonexistent/wallets', {
      headers: authHeaders(rawKey),
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await walletRoutes.request('/services/fake/wallets');
    expect(res.status).toBe(401);
  });
});
