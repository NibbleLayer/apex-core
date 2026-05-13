import { EvmAdapter } from './evm-adapter.js';
import { evmProfiles } from './profiles.js';
export { EvmAdapter, evmProfiles };

/**
 * Convenience function: register the EVM adapter and all built-in profiles.
 *
 * Usage:
 * ```ts
 * import { NetworkRegistry } from '@nibblelayer/apex-network';
 * import { registerEVM } from '@nibblelayer/apex-network-evm';
 *
 * const registry = new NetworkRegistry();
 * registerEVM(registry);
 * ```
 */
export function registerEVM(registry: import('@nibblelayer/apex-network').NetworkRegistry): void {
  registry.registerAdapter(new EvmAdapter());
  registry.registerProfiles(evmProfiles);
}
