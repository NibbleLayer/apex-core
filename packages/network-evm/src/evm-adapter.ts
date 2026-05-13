import type { ChainAdapter, NetworkProfile, NormalizedAssetRef, FinalityPolicy } from '@nibblelayer/apex-network';

/**
 * EVM chain adapter.
 *
 * Provides validation and normalization for Ethereum Virtual Machine
 * compatible chains (Base, Ethereum, Optimism, Arbitrum, etc.).
 */
export class EvmAdapter implements ChainAdapter {
  readonly family = 'evm';

  // ── Address helpers ─────────────────────────────────────────

  private isValidHexAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private isValidHexTxHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  // ── Validation ──────────────────────────────────────────────

  validateAddress(address: string, _profile: NetworkProfile): boolean {
    return this.isValidHexAddress(address);
  }

  validateAssetRef(ref: string, profile: NetworkProfile): boolean {
    // Native asset symbol match
    if (profile.defaultAssets.some(a => a.isNative && a.symbol === ref)) {
      return true;
    }
    // ERC-20 token address
    return this.isValidHexAddress(ref);
  }

  validateTxHash(hash: string): boolean {
    return this.isValidHexTxHash(hash);
  }

  // ── Normalization ───────────────────────────────────────────

  normalizeAddress(address: string, _profile: NetworkProfile): string {
    return address.toLowerCase();
  }

  normalizeAssetRef(ref: string, profile: NetworkProfile): NormalizedAssetRef {
    // Check native asset first
    const native = profile.defaultAssets.find(a => a.isNative);
    if (native && (ref === 'native' || ref === native.symbol)) {
      return { ...native };
    }

    // Assume ERC-20 token address
    const normalizedAddr = ref.toLowerCase();
    return {
      symbol: normalizedAddr.slice(0, 6).toUpperCase(),
      name: `ERC-20 ${normalizedAddr.slice(0, 10)}...`,
      address: normalizedAddr,
      decimals: 18,
      isNative: false,
    };
  }

  // ── UX Helpers ──────────────────────────────────────────────

  getExplorerTxUrl(profile: NetworkProfile, txHash: string): string {
    const base = profile.explorerBaseUrl.replace(/\/$/, '');
    return `${base}/tx/${txHash}`;
  }

  getExplorerAddressUrl(profile: NetworkProfile, address: string): string {
    const base = profile.explorerBaseUrl.replace(/\/$/, '');
    return `${base}/address/${address}`;
  }

  getProfileDisplayName(profile: NetworkProfile): string {
    return profile.mode === 'test'
      ? `${profile.displayName} (test)`
      : profile.displayName;
  }

  // ── Protocol Defaults ───────────────────────────────────────

  getDefaultFacilitatorUrl(profile: NetworkProfile): string {
    return profile.defaultFacilitatorUrl;
  }

  getFinalityPolicy(profile: NetworkProfile): FinalityPolicy {
    if (profile.mode === 'production') {
      return { minConfirmations: 15, averageBlockTimeMs: 2000, safeWaitMs: 30_000 };
    }
    return { minConfirmations: 1, averageBlockTimeMs: 2000, safeWaitMs: 5_000 };
  }

  getDefaultBlockExplorer(profile: NetworkProfile): string {
    return profile.explorerBaseUrl;
  }
}
