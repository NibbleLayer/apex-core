import type { ApexManifest, SignedManifestEnvelope } from '@nibblelayer/apex-contracts';
import {
  apexManifestSchema,
  signedManifestEnvelopeSchema,
} from '@nibblelayer/apex-contracts/schemas';
import {
  ApexConnectionError,
  ApexManifestValidationError,
  ApexMiddlewareInitializationError,
  type ZodIssueLike,
} from './errors.js';
import type { ApexClientConfig } from './types.js';
import { verifySignedManifestEnvelope } from './manifest-envelope.js';

type ParseFailure = { success: false; error: { issues: ZodIssueLike[] } };

type FullConfig = ApexClientConfig & {
  refreshIntervalMs: number;
  enableIdempotency: boolean;
  eventDelivery: 'fire-and-forget' | 'batched';
};

export class ManifestManager {
  private cache: ApexManifest | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private abortController: AbortController | null = null;
  private currentRefreshIntervalMs: number;

  constructor(private config: FullConfig) {
    validateConfig(config);
    this.currentRefreshIntervalMs = config.refreshIntervalMs;
  }

  async fetchManifest(): Promise<ApexManifest> {
    const url = this.buildManifestUrl();

    try {
      this.abortController = new AbortController();
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        if (this.cache) {
          this.emit('manifest.stale', this.cache);
          return this.cache;
        }
        throw new ApexConnectionError(
          `Failed to fetch manifest: HTTP ${response.status}`,
        );
      }

      const data = await response.json();
      const result = this.parseManifestResponse(data);

      if (!result.success) {
        if (this.cache) {
          this.emit('manifest.stale', this.cache);
          return this.cache;
        }
        throw new ApexManifestValidationError(
          'Invalid manifest format',
          toZodIssueLikes(result.error.issues),
        );
      }

      const manifest = result.data;
      const changed = !this.cache || this.cache.version !== manifest.version;
      this.cache = manifest;
      this.updateRefreshInterval(manifest.refreshIntervalMs);

      if (changed) {
        this.emit('manifest.refreshed', manifest);
      }

      return manifest;
    } catch (error) {
      if (
        error instanceof ApexConnectionError ||
        error instanceof ApexManifestValidationError
      ) {
        throw error;
      }
      // Network error — use stale cache if available
      if (this.cache) {
        this.emit('manifest.stale', this.cache);
        return this.cache;
      }
      throw new ApexConnectionError(
        `Failed to connect to Apex: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  startAutoRefresh(): void {
    if (this.refreshTimer) return;
    this.startRefreshTimer();
  }

  private startRefreshTimer(): void {
    this.refreshTimer = setInterval(() => {
      this.fetchManifest().catch(() => {
        /* errors emitted internally */
      });
    }, this.currentRefreshIntervalMs);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  getCached(): ApexManifest | null {
    return this.cache;
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }

  private updateRefreshInterval(refreshIntervalMs: number): void {
    if (refreshIntervalMs === this.currentRefreshIntervalMs) {
      return;
    }

    this.currentRefreshIntervalMs = refreshIntervalMs;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.startRefreshTimer();
    }
  }

  private buildManifestUrl(): string {
    if (!this.isSignedManifestModeEnabled()) {
      return `${this.config.apexUrl}/services/${this.config.serviceId}/manifest?env=${this.config.environment}`;
    }

    return `${this.config.apexUrl}/sdk/manifest`;
  }

  private parseManifestResponse(data: unknown) {
    if (!this.isSignedManifestModeEnabled()) {
      return apexManifestSchema.safeParse(data);
    }

    const result = this.parseSignedManifestEnvelope(data);
    if (!result.success) {
      return result;
    }

    if (this.config.verifySignedManifest !== false) {
      const verified = verifySignedManifestEnvelope({
        envelope: result.data,
        apiKey: this.config.apiKey,
      });

      if (!verified) {
        return {
          success: false as const,
          error: {
            issues: [
              {
                code: 'custom',
                path: ['signature'],
                message: 'Invalid manifest signature',
              },
            ],
          },
        };
      }
    }

    const contextValidation = this.validateSignedManifestContext(result.data);
    if (contextValidation) {
      return contextValidation;
    }

    return apexManifestSchema.safeParse(result.data.manifest);
  }

  private isSignedManifestModeEnabled(): boolean {
    if (typeof this.config.useSignedManifest === 'boolean') {
      return this.config.useSignedManifest;
    }

    return this.config.apiKey.startsWith('apx_sdk_');
  }

  private parseSignedManifestEnvelope(data: unknown) {
    return signedManifestEnvelopeSchema.safeParse(data);
  }

  private validateSignedManifestContext(
    envelope: SignedManifestEnvelope,
  ): ParseFailure | null {
    if (
      envelope.signature.expiresAt &&
      Date.parse(envelope.signature.expiresAt) <= Date.now()
    ) {
      return createManifestIssue(
        ['signature', 'expiresAt'],
        'Manifest signature has expired',
      );
    }

    if (this.config.serviceId && envelope.manifest.serviceId !== this.config.serviceId) {
      return createManifestIssue(
        ['manifest', 'serviceId'],
        'Signed manifest serviceId does not match requested serviceId',
      );
    }

    if (this.config.environment && envelope.manifest.environment !== this.config.environment) {
      return createManifestIssue(
        ['manifest', 'environment'],
        'Signed manifest environment does not match requested environment',
      );
    }

    return null;
  }
}

function createManifestIssue(path: ZodIssueLike['path'], message: string): ParseFailure {
  return {
    success: false,
    error: {
      issues: [{ code: 'custom', path, message }],
    },
  };
}

function validateConfig(config: FullConfig): void {
  const signedManifestMode = typeof config.useSignedManifest === 'boolean'
    ? config.useSignedManifest
    : config.apiKey.startsWith('apx_sdk_');

  if (signedManifestMode) {
    return;
  }

  if (!config.serviceId || !config.environment) {
    throw new ApexMiddlewareInitializationError(
      'Apex legacy unsigned manifest mode requires serviceId and environment. Provide both options, use a scoped apx_sdk_ token, or set useSignedManifest: true.',
    );
  }
}

function toZodIssueLikes(issues: readonly ZodIssueLike[]): ZodIssueLike[] {
  return issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
}
