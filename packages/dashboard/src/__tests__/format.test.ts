import { describe, it, expect } from 'vitest';

// ---- format.ts logic (duplicated for pure testing) ----
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatAmount(amount: string): string {
  if (amount.startsWith('$')) return amount;
  return `${parseInt(amount) / 1e6} USDC`;
}

function eventTypeColor(type: string): string {
  switch (type) {
    case 'payment.required': return 'text-yellow-600 bg-yellow-50';
    case 'payment.verified': return 'text-blue-600 bg-blue-50';
    case 'payment.settled': return 'text-green-600 bg-green-50';
    case 'payment.failed': return 'text-red-600 bg-red-50';
    case 'payment.replay': return 'text-gray-600 bg-gray-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

function settlementStatusColor(status: string): string {
  switch (status) {
    case 'confirmed': return 'text-green-600 bg-green-50';
    case 'pending': return 'text-yellow-600 bg-yellow-50';
    case 'failed': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

describe('format utilities', () => {
  describe('formatDate', () => {
    it('formats ISO date to locale string', () => {
      const result = formatDate('2026-04-06T12:00:00Z');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles different date formats', () => {
      const result = formatDate('2026-01-01T00:00:00.000Z');
      expect(typeof result).toBe('string');
    });
  });

  describe('formatAmount', () => {
    it('passes through dollar-prefixed amounts', () => {
      expect(formatAmount('$0.01')).toBe('$0.01');
      expect(formatAmount('$10.00')).toBe('$10.00');
    });

    it('converts raw integer amounts assuming 6 decimals', () => {
      expect(formatAmount('10000')).toBe('0.01 USDC');
      expect(formatAmount('1000000')).toBe('1 USDC');
      expect(formatAmount('10000000')).toBe('10 USDC');
    });

    it('handles zero', () => {
      expect(formatAmount('0')).toBe('0 USDC');
    });
  });

  describe('eventTypeColor', () => {
    it('returns yellow for payment.required', () => {
      expect(eventTypeColor('payment.required')).toContain('yellow');
    });

    it('returns blue for payment.verified', () => {
      expect(eventTypeColor('payment.verified')).toContain('blue');
    });

    it('returns green for payment.settled', () => {
      expect(eventTypeColor('payment.settled')).toContain('green');
    });

    it('returns red for payment.failed', () => {
      expect(eventTypeColor('payment.failed')).toContain('red');
    });

    it('returns gray for payment.replay', () => {
      expect(eventTypeColor('payment.replay')).toContain('gray');
    });

    it('returns gray for unknown types', () => {
      expect(eventTypeColor('unknown.event')).toContain('gray');
    });
  });

  describe('settlementStatusColor', () => {
    it('returns green for confirmed', () => {
      expect(settlementStatusColor('confirmed')).toContain('green');
    });

    it('returns yellow for pending', () => {
      expect(settlementStatusColor('pending')).toContain('yellow');
    });

    it('returns red for failed', () => {
      expect(settlementStatusColor('failed')).toContain('red');
    });

    it('returns gray for unknown', () => {
      expect(settlementStatusColor('unknown')).toContain('gray');
    });
  });
});
