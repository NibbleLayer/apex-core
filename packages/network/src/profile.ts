/**
 * Network profile — a concrete network instance.
 *
 * Represents a specific network like "Base Sepolia" or "Solana Mainnet".
 * Each profile belongs to a chain family (EVM, Solana, etc.) and carries
 * metadata needed for validation, UX, and protocol defaults.
 */

/** Normalized reference to a blockchain asset/token */
export interface NormalizedAssetRef {
  symbol: string;
  name: string;
  /** Contract address or 'native' for the chain's native asset */
  address: string;
  decimals: number;
  isNative: boolean;
  icon?: string;
}

/** Finality policy for settlement confirmation */
export interface FinalityPolicy {
  minConfirmations: number;
  averageBlockTimeMs: number;
  /** Recommended wall-clock wait for safe finality */
  safeWaitMs: number;
}

/**
 * Network profile — immutable configuration for a blockchain network.
 */
export interface NetworkProfile {
  /** Stable identifier, e.g. 'base-sepolia', 'base-mainnet' */
  id: string;
  /** Chain family: 'evm', 'solana', etc. */
  chainFamily: string;
  /** Human-readable name, e.g. 'Base Sepolia' */
  displayName: string;
  /** Short user-facing description */
  description?: string;
  /** CAIP-2 identifier, e.g. 'eip155:84532' */
  caip2: string;
  /** Environment mode */
  mode: 'test' | 'production';
  /** Optional icon identifier */
  icon?: string;
  /** Default x402 facilitator URL for this network */
  defaultFacilitatorUrl: string;
  /** Assets available by default on this network */
  defaultAssets: NormalizedAssetRef[];
  /** Base URL for a block explorer (no trailing slash) */
  explorerBaseUrl: string;
  /** Required block confirmations for settlement finality */
  requiredConfirmations: number;
  /** If true, this profile is deprecated and should not be used for new setups */
  isDeprecated?: boolean;
}
