import { describe, it, expect } from 'vitest';
import { NetworkRegistry } from '../registry.js';
import type { ChainAdapter } from '../adapter.js';
import type { NetworkProfile } from '../profile.js';

// ── Mock adapter for testing ──────────────────────────────────

class MockAdapter implements ChainAdapter {
  readonly family = 'mock';

  validateAddress(address: string, _profile: NetworkProfile): boolean {
    return address.startsWith('0x') && address.length === 42;
  }

  validateAssetRef(ref: string, _profile: NetworkProfile): boolean {
    return ref === 'MOCK' || (ref.startsWith('0x') && ref.length === 42);
  }

  validateTxHash(hash: string): boolean {
    return /^0x[a-f0-9]{64}$/i.test(hash);
  }

  normalizeAddress(address: string, _profile: NetworkProfile): string {
    return address.toLowerCase();
  }

  normalizeAssetRef(ref: string, profile: NetworkProfile): ReturnType<ChainAdapter['normalizeAssetRef']> {
    const native = profile.defaultAssets.find(a => a.isNative);
    if (ref === 'native' || ref === native?.symbol) {
      return native!;
    }
    return { symbol: ref, name: ref, address: ref.toLowerCase(), decimals: 18, isNative: false };
  }

  getExplorerTxUrl(profile: NetworkProfile, txHash: string): string {
    return `${profile.explorerBaseUrl}/tx/${txHash}`;
  }

  getExplorerAddressUrl(profile: NetworkProfile, address: string): string {
    return `${profile.explorerBaseUrl}/address/${address}`;
  }

  getProfileDisplayName(profile: NetworkProfile): string {
    return profile.displayName;
  }

  getDefaultFacilitatorUrl(profile: NetworkProfile): string {
    return profile.defaultFacilitatorUrl;
  }

  getFinalityPolicy(_profile: NetworkProfile) {
    return { minConfirmations: 1, averageBlockTimeMs: 2000, safeWaitMs: 5000 };
  }

  getDefaultBlockExplorer(profile: NetworkProfile): string {
    return profile.explorerBaseUrl;
  }
}

// ── Fixtures ──────────────────────────────────────────────────

const testProfile: NetworkProfile = {
  id: 'mock-testnet',
  chainFamily: 'mock',
  displayName: 'Mock Testnet',
  caip2: 'mock:12345',
  mode: 'test',
  defaultFacilitatorUrl: 'https://facilitator.mock',
  defaultAssets: [{ symbol: 'MOCK', name: 'Mock Coin', address: 'native', decimals: 18, isNative: true }],
  explorerBaseUrl: 'https://explorer.mock',
  requiredConfirmations: 1,
};

const prodProfile: NetworkProfile = {
  id: 'mock-mainnet',
  chainFamily: 'mock',
  displayName: 'Mock Mainnet',
  caip2: 'mock:67890',
  mode: 'production',
  defaultFacilitatorUrl: 'https://facilitator.mock/prod',
  defaultAssets: [{ symbol: 'MOCK', name: 'Mock Coin', address: 'native', decimals: 18, isNative: true }],
  explorerBaseUrl: 'https://explorer.mock/mainnet',
  requiredConfirmations: 15,
};

// ── Tests ─────────────────────────────────────────────────────

describe('NetworkRegistry', () => {
  it('should register an adapter and profiles', () => {
    const registry = new NetworkRegistry();
    registry.registerAdapter(new MockAdapter());
    registry.registerProfiles([testProfile, prodProfile]);

    expect(registry.families).toEqual(['mock']);
    expect(registry.profileCount).toBe(2);
  });

  it('should throw when registering profile without adapter', () => {
    const registry = new NetworkRegistry();
    expect(() => registry.registerProfile(testProfile)).toThrow(
      'no adapter registered for chain family'
    );
  });

  it('should get profile by id', () => {
    const registry = new NetworkRegistry();
    registry.registerAdapter(new MockAdapter());
    registry.registerProfiles([testProfile, prodProfile]);

    const p = registry.getProfile('mock-testnet');
    expect(p).toBeDefined();
    expect(p!.displayName).toBe('Mock Testnet');
  });

  it('should return undefined for unknown profile', () => {
    const registry = new NetworkRegistry();
    expect(registry.getProfile('nonexistent')).toBeUndefined();
  });

  it('should get adapter by family', () => {
    const registry = new NetworkRegistry();
    const adapter = new MockAdapter();
    registry.registerAdapter(adapter);

    expect(registry.getAdapter('mock')).toBe(adapter);
  });

  it('should list profiles by mode', () => {
    const registry = new NetworkRegistry();
    registry.registerAdapter(new MockAdapter());
    registry.registerProfiles([testProfile, prodProfile]);

    const testProfiles = registry.listTestProfiles();
    expect(testProfiles).toHaveLength(1);
    expect(testProfiles[0].id).toBe('mock-testnet');

    const prodProfiles = registry.listProductionProfiles();
    expect(prodProfiles).toHaveLength(1);
    expect(prodProfiles[0].id).toBe('mock-mainnet');
  });

  it('should list profiles by family', () => {
    const registry = new NetworkRegistry();
    registry.registerAdapter(new MockAdapter());
    registry.registerProfiles([testProfile, prodProfile]);

    const profiles = registry.listByFamily('mock');
    expect(profiles).toHaveLength(2);
  });

  it('should check profile existence', () => {
    const registry = new NetworkRegistry();
    registry.registerAdapter(new MockAdapter());
    registry.registerProfile(testProfile);

    expect(registry.hasProfile('mock-testnet')).toBe(true);
    expect(registry.hasProfile('mock-mainnet')).toBe(false);
  });
});

describe('MockAdapter', () => {
  const adapter = new MockAdapter();

  it('should validate addresses', () => {
    expect(adapter.validateAddress('0x1234567890abcdef1234567890abcdef12345678', testProfile)).toBe(true);
    expect(adapter.validateAddress('0x123', testProfile)).toBe(false);
    expect(adapter.validateAddress('invalid', testProfile)).toBe(false);
  });

  it('should validate tx hashes', () => {
    expect(adapter.validateTxHash('0x' + 'a'.repeat(64))).toBe(true);
    expect(adapter.validateTxHash('0xshort')).toBe(false);
  });

  it('should build explorer URLs', () => {
    const txUrl = adapter.getExplorerTxUrl(testProfile, '0xabc');
    expect(txUrl).toBe('https://explorer.mock/tx/0xabc');

    const addrUrl = adapter.getExplorerAddressUrl(testProfile, '0xdef');
    expect(addrUrl).toBe('https://explorer.mock/address/0xdef');
  });

  it('should normalize addresses to lowercase', () => {
    expect(adapter.normalizeAddress('0xABC123', testProfile)).toBe('0xabc123');
  });

  it('should resolve native asset ref', () => {
    const ref = adapter.normalizeAssetRef('native', testProfile);
    expect(ref.isNative).toBe(true);
    expect(ref.symbol).toBe('MOCK');
  });
});
