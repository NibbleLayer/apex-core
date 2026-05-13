import type { ChainAdapter } from './adapter.js';
import type { NetworkProfile } from './profile.js';

/**
 * Network registry — central registry of chain adapters and network profiles.
 *
 * Usage:
 * ```ts
 * const registry = new NetworkRegistry();
 * registry.registerAdapter(new EvmAdapter());
 * registry.registerProfile(baseSepoliaProfile);
 *
 * const profile = registry.getProfile('base-sepolia');
 * const adapter = registry.getAdapter('evm');
 * ```
 */
export class NetworkRegistry {
  private adapters = new Map<string, ChainAdapter>();
  private profiles = new Map<string, NetworkProfile>();

  // ── Registration ────────────────────────────────────────────

  /**
   * Register a chain adapter.
   * Adapters are singletons — registering twice with the same family overwrites.
   */
  registerAdapter(adapter: ChainAdapter): void {
    this.adapters.set(adapter.family, adapter);
  }

  /**
   * Register a network profile.
   * The profile's chain family MUST have a registered adapter.
   * @throws If no adapter is registered for the profile's chain family.
   */
  registerProfile(profile: NetworkProfile): void {
    if (!this.adapters.has(profile.chainFamily)) {
      throw new Error(
        `Cannot register profile '${profile.id}': ` +
        `no adapter registered for chain family '${profile.chainFamily}'. ` +
        `Register an adapter first via registerAdapter().`
      );
    }
    this.profiles.set(profile.id, profile);
  }

  /**
   * Register multiple profiles at once.
   * @throws If any profile's chain family has no registered adapter.
   */
  registerProfiles(profiles: NetworkProfile[]): void {
    for (const profile of profiles) {
      this.registerProfile(profile);
    }
  }

  // ── Queries ─────────────────────────────────────────────────

  /** Get a profile by its stable ID */
  getProfile(id: string): NetworkProfile | undefined {
    return this.profiles.get(id);
  }

  /** Get adapter by chain family */
  getAdapter(family: string): ChainAdapter | undefined {
    return this.adapters.get(family);
  }

  /** List all profiles in test mode */
  listTestProfiles(): NetworkProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.mode === 'test');
  }

  /** List all profiles in production mode */
  listProductionProfiles(): NetworkProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.mode === 'production');
  }

  /** List profiles by chain family */
  listByFamily(family: string): NetworkProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.chainFamily === family);
  }

  /** List all registered profiles */
  listAll(): NetworkProfile[] {
    return Array.from(this.profiles.values());
  }

  /** Check if a profile exists */
  hasProfile(id: string): boolean {
    return this.profiles.has(id);
  }

  /** Get the number of registered profiles */
  get profileCount(): number {
    return this.profiles.size;
  }

  /** Get registered chain family identifiers */
  get families(): string[] {
    return Array.from(this.adapters.keys());
  }
}
