import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackUsage, checkPlanLimit } from '../../src/services/usage-service.js';

describe('trackUsage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs usage event with [USAGE] prefix', () => {
    trackUsage({ organizationId: 'org_123', eventType: 'payment_events' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toBe('[USAGE]');
  });

  it('logs JSON with organizationId, eventType, and period', () => {
    trackUsage({ organizationId: 'org_123', eventType: 'api_calls' });
    const jsonStr = logSpy.mock.calls[0][1];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.organizationId).toBe('org_123');
    expect(parsed.eventType).toBe('api_calls');
    expect(parsed.period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('uses YYYY-MM format for period', () => {
    trackUsage({ organizationId: 'org_1', eventType: 'settlements' });
    const jsonStr = logSpy.mock.calls[0][1];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.period).toMatch(/^20\d{2}-(0[1-9]|1[0-2])$/);
  });

  it('includes increment when provided', () => {
    trackUsage({ organizationId: 'org_1', eventType: 'api_calls', increment: 5 });
    const jsonStr = logSpy.mock.calls[0][1];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.increment).toBe(5);
  });

  it('omits increment when not provided', () => {
    trackUsage({ organizationId: 'org_1', eventType: 'payment_events' });
    const jsonStr = logSpy.mock.calls[0][1];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.increment).toBeUndefined();
  });

  it('handles all valid event types', () => {
    const eventTypes = ['payment_events', 'settlements', 'api_calls'] as const;
    for (const eventType of eventTypes) {
      trackUsage({ organizationId: 'org_1', eventType });
    }
    expect(logSpy).toHaveBeenCalledTimes(3);
  });
});

describe('checkPlanLimit', () => {
  it('always returns true in OSS mode', () => {
    expect(checkPlanLimit('org_1', 'payment_events')).toBe(true);
    expect(checkPlanLimit('org_2', 'settlements')).toBe(true);
    expect(checkPlanLimit('org_3', 'api_calls')).toBe(true);
  });

  it('returns true regardless of organizationId', () => {
    expect(checkPlanLimit('', 'anything')).toBe(true);
    expect(checkPlanLimit('nonexistent', 'whatever')).toBe(true);
  });
});
