import type { NetworkProfile, NormalizedAssetRef, FinalityPolicy } from './profile.js';

/**
 * Chain adapter — family-level implementation for validation, normalization,
 * and protocol defaults.
 *
 * Each chain family (EVM, Solana, etc.) implements this interface.
 * Adapters are stateless and can be registered as singletons.
 */
export interface ChainAdapter {
  /** Unique family identifier, e.g. 'evm', 'solana' */
  readonly family: string;

  // ── Validation ──────────────────────────────────────────────

  /** Validate a blockchain address for the given network profile */
  validateAddress(address: string, profile: NetworkProfile): boolean;

  /** Validate an asset reference (symbol or address) for the given network */
  validateAssetRef(ref: string, profile: NetworkProfile): boolean;

  /** Validate a transaction hash format */
  validateTxHash(hash: string): boolean;

  // ── Normalization ───────────────────────────────────────────

  /** Normalize an address to canonical form */
  normalizeAddress(address: string, profile: NetworkProfile): string;

  /** Resolve an asset reference to a normalized form */
  normalizeAssetRef(ref: string, profile: NetworkProfile): NormalizedAssetRef;

  // ── UX Helpers ──────────────────────────────────────────────

  /** Build a block explorer URL for a transaction */
  getExplorerTxUrl(profile: NetworkProfile, txHash: string): string;

  /** Build a block explorer URL for an address */
  getExplorerAddressUrl(profile: NetworkProfile, address: string): string;

  /** Get a human-readable display name for a profile */
  getProfileDisplayName(profile: NetworkProfile): string;

  // ── Protocol Defaults ───────────────────────────────────────

  /** Resolve the default facilitator URL for a profile */
  getDefaultFacilitatorUrl(profile: NetworkProfile): string;

  /** Get the finality policy for a network profile */
  getFinalityPolicy(profile: NetworkProfile): FinalityPolicy;

  /** Get the default block explorer base URL */
  getDefaultBlockExplorer(profile: NetworkProfile): string;
}
