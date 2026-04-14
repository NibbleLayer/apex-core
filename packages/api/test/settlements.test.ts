import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { settlementRoutes } from '../src/routes/settlements.js';
import { setDbResolver, resetDbResolver } from '../src/db/resolver.js';
import { testDb } from './setup.js';
import {
  createTestOrgWithKey,
  createTestOrgKeyAndService,
  jsonAuthHeaders,
  authHeaders,
  createTestRoute,
} from './helpers.js';
import { settlements, paymentEvents } from '@nibblelayer/apex-persistence/db';
import { createId } from '../src/utils/id.js';

beforeAll(() => {
  setDbResolver(async () => testDb);
});

afterAll(() => {
  resetDbResolver();
});

async function seedSettlements(serviceId: string, routeId: string) {
  // Create a payment event first
  const eventId = createId();
  await testDb.insert(paymentEvents).values({
    id: eventId,
    serviceId,
    routeId,
    type: 'payment.settled',
    requestId: 'req_settlement_test',
    paymentIdentifier: null,
    buyerAddress: null,
    payload: null,
  });

  // Create settlements
  await testDb.insert(settlements).values([
    {
      id: createId(),
      serviceId,
      routeId,
      paymentEventId: eventId,
      amount: '$0.01',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      settlementReference: '0xconfirmed',
      status: 'confirmed',
    },
    {
      id: createId(),
      serviceId,
      routeId,
      paymentEventId: eventId,
      amount: '$0.05',
      token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      network: 'eip155:84532',
      settlementReference: null,
      status: 'pending',
    },
  ]);

  return eventId;
}

describe('GET /services/:id/settlements', () => {
  it('returns paginated settlements', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);
    await seedSettlements(serviceId, routeId);

    const res = await settlementRoutes.request(
      `/services/${serviceId}/settlements?limit=1&offset=0`,
      { headers: authHeaders(rawKey) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settlements).toHaveLength(1);
    expect(body.total).toBe(2);
  });

  it('filters by status', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();
    const routeId = await createTestRoute(serviceId);
    await seedSettlements(serviceId, routeId);

    const res = await settlementRoutes.request(
      `/services/${serviceId}/settlements?status=confirmed`,
      { headers: authHeaders(rawKey) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settlements).toHaveLength(1);
    expect(body.settlements[0].status).toBe('confirmed');
    expect(body.total).toBe(1);
  });

  it('returns empty array when no settlements', async () => {
    const { rawKey, serviceId } = await createTestOrgKeyAndService();

    const res = await settlementRoutes.request(
      `/services/${serviceId}/settlements`,
      { headers: authHeaders(rawKey) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settlements).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns 404 for non-existent service', async () => {
    const { rawKey } = await createTestOrgWithKey();

    const res = await settlementRoutes.request(
      '/services/c_nonexistent/settlements',
      { headers: authHeaders(rawKey) },
    );

    expect(res.status).toBe(404);
  });

  it('returns 401 without authentication', async () => {
    const res = await settlementRoutes.request('/services/fake/settlements');

    expect(res.status).toBe(401);
  });
});
