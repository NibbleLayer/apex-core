import type { ApexManifest } from '@nibblelayer/apex-contracts';
import { apexManifestSchema } from '@nibblelayer/apex-contracts/schemas';
import { ApexConnectionError, ApexManifestValidationError } from './errors.js';
import type { ApexClientConfig } from './types.js';

type FullConfig = Required<ApexClientConfig>;

export class ManifestManager {
  private cache: ApexManifest | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private abortController: AbortController | null = null;
  private currentRefreshIntervalMs: number;

  constructor(private config: FullConfig) {
    this.currentRefreshIntervalMs = config.refreshIntervalMs;
  }

  async fetchManifest(): Promise<ApexManifest> {
    const url = `${this.config.apexUrl}/services/${this.config.serviceId}/manifest?env=${this.config.environment}`;

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
      const result = apexManifestSchema.safeParse(data);

      if (!result.success) {
        if (this.cache) {
          this.emit('manifest.stale', this.cache);
          return this.cache;
        }
        throw new ApexManifestValidationError(
          'Invalid manifest format',
          result.error.issues,
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
}
