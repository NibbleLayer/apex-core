import { describe, expect, it } from 'vitest';
import {
  buildSettlementRecord,
  buildWebhookDeliveries,
  validateEventPayload,
} from '../../src/services/event-service.js';

const validPayload = {
  serviceId: 'svc_123',
  routeId: 'route_123',
  type: 'payment.settled' as const,
  requestId: 'req_123',
  paymentIdentifier: 'pay_123',
  amount: '$0.01',
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  network: 'eip155:84532',
  settlementReference: '0xabc',
  timestamp: '2026-04-12T00:00:00.000Z',
};

describe('validateEventPayload', () => {
  it('returns a structured validation error for invalid payloads', () => {
    const result = validateEventPayload({ ...validPayload, type: 'invalid.type' });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected invalid result');
    }

    expect(result.status).toBe(400);
    expect(result.body.error).toContain('Invalid enum value');
  });

  it('returns the parsed payload for valid input', () => {
    const result = validateEventPayload(validPayload);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected valid result');
    }

    expect(result.payload.requestId).toBe('req_123');
  });
});

describe('buildSettlementRecord', () => {
  it('normalizes settlement defaults from a settled payment event', () => {
    const parsed = validateEventPayload(validPayload);
    if (!parsed.ok) {
      throw new Error('Expected valid result');
    }

    const settlement = buildSettlementRecord(parsed.payload, 'evt_123');

    expect(settlement.paymentEventId).toBe('evt_123');
    expect(settlement.amount).toBe('$0.01');
    expect(settlement.status).toBe('pending');
  });
});

describe('buildWebhookDeliveries', () => {
  it('builds a pending delivery for every enabled endpoint', () => {
    const deliveries = buildWebhookDeliveries(
      [{ id: 'wh_1' }, { id: 'wh_2' }],
      'evt_123',
      validPayload,
      validPayload.type,
      new Date('2026-04-12T00:00:00.000Z'),
    );

    expect(deliveries).toHaveLength(2);
    expect(deliveries[0].status).toBe('pending');
    expect(deliveries[0].payload).toEqual({
      id: 'evt_123',
      type: 'payment.settled',
      created_at: '2026-04-12T00:00:00.000Z',
      data: validPayload,
    });
  });
});
