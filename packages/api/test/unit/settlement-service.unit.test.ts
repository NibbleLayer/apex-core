import { describe, expect, it } from 'vitest';
import {
  assertSettlementTransition,
  SettlementTransitionError,
} from '../../src/services/settlement-service.js';

describe('assertSettlementTransition', () => {
  it('allows pending to terminal states', () => {
    expect(assertSettlementTransition('pending', 'confirmed')).toEqual({ idempotent: false });
    expect(assertSettlementTransition('pending', 'failed')).toEqual({ idempotent: false });
  });

  it('treats same-state transitions as idempotent', () => {
    expect(assertSettlementTransition('pending', 'pending')).toEqual({ idempotent: true });
    expect(assertSettlementTransition('confirmed', 'confirmed')).toEqual({ idempotent: true });
    expect(assertSettlementTransition('failed', 'failed')).toEqual({ idempotent: true });
  });

  it('rejects terminal transitions clearly', () => {
    expect(() => assertSettlementTransition('confirmed', 'failed')).toThrow(SettlementTransitionError);
    expect(() => assertSettlementTransition('failed', 'confirmed')).toThrow('Invalid settlement status transition');
  });
});
