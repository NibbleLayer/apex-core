import type { ApexManifest } from '@nibblelayer/apex-contracts';
import type { ApexClientConfig, ApexClient } from './types.js';
import { ManifestManager } from './manifest.js';
import { createMiddlewareFromManifest } from './middleware.js';
import { applyIdempotency } from './idempotency.js';
import { SDKEventEmitter } from './events.js';

interface SDKListeners {
  [event: string]: Set<(...args: any[]) => void>;
}

/**
 * Create an Apex client for protecting Hono routes with x402 payments.
 *
 * Usage:
 * ```typescript
 * const apex = createApexClient({
 *   apiKey: 'apex_...',
 *   serviceId: 'svc_...',
 *   environment: 'test',
 *   apexUrl: 'https://api.apex.nibblelayer.com',
 * });
 *
 * app.use('/api/*', await apex.protect());
 * ```
 */
export function createApexClient(config: ApexClientConfig): ApexClient {
  const fullConfig = {
    refreshIntervalMs: 60000,
    enableIdempotency: true,
    eventDelivery: 'fire-and-forget' as const,
    ...config,
  };

  const listeners: SDKListeners = {};

  const manifestManager = new ManifestManager(fullConfig);
  const eventEmitter = new SDKEventEmitter({
    apexUrl: fullConfig.apexUrl,
    apiKey: fullConfig.apiKey,
    serviceId: fullConfig.serviceId,
  });

  // Forward manifest manager events to client listeners
  manifestManager.on('manifest.refreshed', (manifest: ApexManifest) => {
    eventEmitter.setEventsEndpoint(manifest.eventsEndpoint);
    emit('manifest.refreshed', manifest);
  });
  manifestManager.on('manifest.stale', (manifest: ApexManifest) => {
    emit('manifest.stale', manifest);
  });

  // Forward event emitter errors to client listeners
  // (eventEmitter already logs errors, we just notify client)

  let currentMiddleware: import('hono').MiddlewareHandler | null = null;

  function emit(event: string, ...args: any[]) {
    listeners[event]?.forEach(fn => fn(...args));
  }

  // Build middleware from current manifest
  async function buildMiddleware(manifest: ApexManifest): Promise<import('hono').MiddlewareHandler> {
    const enrichedManifest = applyIdempotency(manifest);
    return createMiddlewareFromManifest(enrichedManifest, (type, data) => {
      emit(type, data);
      eventEmitter.emit(type, data);
    });
  }

  // Initialize: fetch manifest and build middleware
  let initPromise: Promise<void> | null = null;

  function ensureInitialized(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        const manifest = await manifestManager.fetchManifest();
        eventEmitter.setEventsEndpoint(manifest.eventsEndpoint);
        currentMiddleware = await buildMiddleware(manifest);
        manifestManager.startAutoRefresh();

        // Rebuild middleware on manifest change
        manifestManager.on('manifest.refreshed', async (newManifest: ApexManifest) => {
          currentMiddleware = await buildMiddleware(newManifest);
        });
      })();
    }
    return initPromise;
  }

  const client: ApexClient = {
    async protect() {
      await ensureInitialized();
      return async (c, next) => {
        if (currentMiddleware) {
          return currentMiddleware(c, next);
        }
        return next();
      };
    },

    async refreshManifest() {
      return manifestManager.fetchManifest();
    },

    on(event: string, handler: (...args: any[]) => void) {
      if (!listeners[event]) listeners[event] = new Set();
      listeners[event].add(handler);
    },

    off(event: string, handler: (...args: any[]) => void) {
      listeners[event]?.delete(handler);
    },

    close() {
      manifestManager.stopAutoRefresh();
      for (const key of Object.keys(listeners)) {
        listeners[key].clear();
      }
    },
  };

  return client;
}
