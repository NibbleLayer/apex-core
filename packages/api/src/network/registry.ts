import { NetworkRegistry } from '@nibblelayer/apex-network';
import { registerEVM } from '@nibblelayer/apex-network-evm';

let registry: NetworkRegistry | null = null;

/**
 * Get or initialize the global network registry.
 * Pre-loaded with EVM adapter and all built-in profiles.
 */
export function getNetworkRegistry(): NetworkRegistry {
  if (!registry) {
    registry = new NetworkRegistry();
    registerEVM(registry);
  }
  return registry;
}

/**
 * Result of resolving network input.
 */
export interface ResolvedNetwork {
  /** CAIP-2 identifier */
  network: string;
  /** Default facilitator URL for this network */
  facilitatorUrl: string;
  /** Network profile ID if resolved from a profile */
  profileId?: string;
}

/**
 * Resolve network input to CAIP-2 + facilitator URL.
 *
 * Accepts either:
 * - `networkProfileId` ("base-sepolia") → resolved via registry
 * - `network` (raw CAIP-2 "eip155:84532") → matched against known profiles or used as-is
 *
 * @throws If neither network nor networkProfileId is provided.
 */
export function resolveNetwork(params: {
  network?: string;
  networkProfileId?: string;
  mode: 'test' | 'prod';
}): ResolvedNetwork {
  const reg = getNetworkRegistry();

  // Priority 1: profile ID provided
  if (params.networkProfileId) {
    const profile = reg.getProfile(params.networkProfileId);
    if (!profile) {
      throw new Error(`Unknown network profile: '${params.networkProfileId}'`);
    }
    return {
      network: profile.caip2,
      facilitatorUrl: profile.defaultFacilitatorUrl,
      profileId: profile.id,
    };
  }

  // Priority 2: raw CAIP-2 provided
  if (params.network) {
    // Try to match against known profiles
    const allProfiles = reg.listAll();
    const match = allProfiles.find((p) => p.caip2 === params.network);

    if (match) {
      return {
        network: params.network,
        facilitatorUrl: match.defaultFacilitatorUrl,
        profileId: match.id,
      };
    }

    // Unknown CAIP-2 — use legacy defaults (backward compat)
    return {
      network: params.network,
      facilitatorUrl:
        params.mode === 'test'
          ? 'https://x402.org/facilitator'
          : 'https://api.cdp.coinbase.com/platform/v2/x402',
    };
  }

  throw new Error('Either network (CAIP-2) or networkProfileId is required');
}

/**
 * Validate a blockchain address for a given network (CAIP-2).
 *
 * Tries to find the matching adapter for the network and validate.
 * Falls back to accepting the address if no adapter is found
 * (backward compatibility for unknown/legacy networks).
 */
export function validateAddressForNetwork(address: string, network: string): boolean {
  const reg = getNetworkRegistry();

  // Find profile matching this CAIP-2
  const allProfiles = reg.listAll();
  const profile = allProfiles.find((p) => p.caip2 === network);

  if (profile) {
    const adapter = reg.getAdapter(profile.chainFamily);
    if (adapter) {
      return adapter.validateAddress(address, profile);
    }
  }

  // Fallback: use EVM adapter as default for unknown CAIP-2
  // that looks like an EVM chain (eip155:*)
  if (network.startsWith('eip155:')) {
    const evmAdapter = reg.getAdapter('evm');
    const evmProfile = allProfiles.find((p) => p.chainFamily === 'evm');
    if (evmAdapter && evmProfile) {
      return evmAdapter.validateAddress(address, evmProfile);
    }
  }

  // No adapter found — accept any address (backward compat)
  return true;
}
