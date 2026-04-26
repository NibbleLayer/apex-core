// Usage tracking service — OSS stub that logs to console.
// Hosted version replaces with DB increment + plan limit checks.

export interface UsageEvent {
  organizationId: string;
  eventType: 'payment_events' | 'settlements' | 'api_calls';
  increment?: number;
}

export function trackUsage(event: UsageEvent): void {
  // OSS: log only. Hosted: increment DB counter, check plan limits.
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  console.log('[USAGE]', JSON.stringify({ ...event, period }));
}

export function checkPlanLimit(_organizationId: string, _eventType: string): boolean {
  // OSS: always allow. Hosted: check against plan limits.
  return true;
}
