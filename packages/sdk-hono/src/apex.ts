import type { MiddlewareHandler } from 'hono';
import { createApexClient } from './client.js';
import { ApexMiddlewareInitializationError } from './errors.js';
import type { ApexClientConfig } from './types.js';

export interface ApexHonoOptions {
  /** Scoped SDK token (apx_sdk_...) or legacy API key alias. */
  token?: string;
  /** Backward-compatible API key alias. */
  apiKey?: string;
  /** Apex API base URL. */
  apexUrl?: string;
  /** Optional explicit service binding for legacy mode or strict signed-manifest validation. */
  serviceId?: string;
  /** Optional explicit environment binding for legacy mode or strict signed-manifest validation. */
  environment?: 'test' | 'prod';
  refreshIntervalMs?: ApexClientConfig['refreshIntervalMs'];
  enableIdempotency?: ApexClientConfig['enableIdempotency'];
  eventDelivery?: ApexClientConfig['eventDelivery'];
  useSignedManifest?: ApexClientConfig['useSignedManifest'];
  verifySignedManifest?: ApexClientConfig['verifySignedManifest'];
  routeRegistration?: ApexClientConfig['routeRegistration'];
  routeHeartbeatIntervalMs?: ApexClientConfig['routeHeartbeatIntervalMs'];
}

/**
 * Create one-line Apex Hono middleware.
 *
 * Runtime configuration defaults to APEX_TOKEN and APEX_URL so applications can
 * use scoped SDK tokens without hard-coding service or environment identifiers.
 */
export function apex(options: ApexHonoOptions = {}): MiddlewareHandler {
  const apiKey = options.token ?? options.apiKey ?? process.env.APEX_TOKEN;
  const apexUrl = options.apexUrl ?? process.env.APEX_URL;

  if (!apiKey) {
    throw new ApexMiddlewareInitializationError(
      'Missing Apex SDK token. Pass apex({ token }) or set APEX_TOKEN to a scoped apx_sdk_ token.',
    );
  }

  if (!apexUrl) {
    throw new ApexMiddlewareInitializationError(
      'Missing Apex API URL. Pass apex({ apexUrl }) or set APEX_URL to your Apex API base URL.',
    );
  }

  const client = createApexClient({
    apiKey,
    apexUrl,
    serviceId: options.serviceId,
    environment: options.environment,
    refreshIntervalMs: options.refreshIntervalMs,
    enableIdempotency: options.enableIdempotency,
    eventDelivery: options.eventDelivery,
    useSignedManifest: options.useSignedManifest,
    verifySignedManifest: options.verifySignedManifest,
    routeRegistration: options.routeRegistration,
    routeHeartbeatIntervalMs: options.routeHeartbeatIntervalMs,
  });

  let protectedMiddlewarePromise: Promise<MiddlewareHandler> | null = null;

  return async (context, next) => {
    protectedMiddlewarePromise ??= client.protect();
    const protectedMiddleware = await protectedMiddlewarePromise;
    return protectedMiddleware(context, next);
  };
}
