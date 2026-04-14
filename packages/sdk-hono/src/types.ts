import type { ApexManifest, PaymentEventType } from '@nibblelayer/apex-contracts';

export interface ApexClientConfig {
  /** Apex API key (apex_...) */
  apiKey: string;
  /** Service ID from Apex */
  serviceId: string;
  /** Environment to use */
  environment: 'test' | 'prod';
  /** Apex API base URL */
  apexUrl: string;
  /** Manifest refresh interval in ms (default: 60000) */
  refreshIntervalMs?: number;
  /** Enable payment-identifier idempotency (default: true) */
  enableIdempotency?: boolean;
  /** Event delivery mode (default: 'fire-and-forget') */
  eventDelivery?: 'fire-and-forget' | 'batched';
}

export interface ApexClient {
  /** Returns Hono middleware that protects routes */
  protect(): Promise<import('hono').MiddlewareHandler>;
  /** Force refresh the manifest */
  refreshManifest(): Promise<ApexManifest>;
  /** Register event listener */
  on(event: string, handler: (...args: any[]) => void): void;
  /** Remove event listener */
  off(event: string, handler: (...args: any[]) => void): void;
  /** Stop refresh timer and cleanup */
  close(): void;
}

export type SDKEventType =
  | 'manifest.refreshed'
  | 'manifest.stale'
  | 'error'
  | `payment.${string}`;

export interface SDKErrorEvent {
  type: string;
  error: Error;
}
