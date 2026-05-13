import { describe, it, expect } from 'vitest';
import { EvmAdapter } from '../evm-adapter.js';
import { evmProfiles } from '../profiles.js';
import type { NetworkProfile } from '@nibblelayer/apex-network';

const adapter = new EvmAdapter();

// Find test and production profiles for testing
const baseSepolia = evmProfiles.find(p => p.id === 'base-sepolia')!;
const baseMainnet = evmProfiles.find(p => p.id === 'base-mainnet')!;

describe('EvmAdapter', () => {
  it('should have family "evm"', () => {
    expect(adapter.family).toBe('evm');
  });

  // ── Address validation ────────────────────────────────────

  describe('validateAddress', () => {
    it('should accept valid hex addresses', () => {
      expect(adapter.validateAddress('0x1234567890abcdef1234567890abcdef12345678', baseSepolia)).toBe(true);
      expect(adapter.validateAddress('0xDEADBEEF1234567890abcdef1234567890abcdef', baseSepolia)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(adapter.validateAddress('0x123', baseSepolia)).toBe(false);
      expect(adapter.validateAddress('0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', baseSepolia)).toBe(false);
      expect(adapter.validateAddress('1234567890abcdef1234567890abcdef12345678', baseSepolia)).toBe(false);
      expect(adapter.validateAddress('', baseSepolia)).toBe(false);
    });
  });

  // ── Asset validation ──────────────────────────────────────

  describe('validateAssetRef', () => {
    it('should accept native asset symbol', () => {
      expect(adapter.validateAssetRef('ETH', baseSepolia)).toBe(true);
    });

    it('should accept ERC-20 token addresses', () => {
      expect(adapter.validateAssetRef('0x1234567890abcdef1234567890abcdef12345678', baseSepolia)).toBe(true);
    });

    it('should reject invalid asset refs', () => {
      expect(adapter.validateAssetRef('INVALID', baseSepolia)).toBe(false);
      expect(adapter.validateAssetRef('0x123', baseSepolia)).toBe(false);
    });
  });

  // ── Tx hash validation ────────────────────────────────────

  describe('validateTxHash', () => {
    it('should accept valid tx hashes', () => {
      expect(adapter.validateTxHash('0x' + 'a'.repeat(64))).toBe(true);
      expect(adapter.validateTxHash('0x' + 'f'.repeat(64))).toBe(true);
    });

    it('should reject invalid tx hashes', () => {
      expect(adapter.validateTxHash('0xshort')).toBe(false);
      expect(adapter.validateTxHash('')).toBe(false);
      expect(adapter.validateTxHash('abc' + '0'.repeat(64))).toBe(false);
    });
  });

  // ── Address normalization ──────────────────────────────────

  describe('normalizeAddress', () => {
    it('should lowercase addresses', () => {
      expect(adapter.normalizeAddress('0xABC1234567890abcdef1234567890abcdef12345678', baseSepolia))
        .toBe('0xabc1234567890abcdef1234567890abcdef12345678');
    });
  });

  // ── Explorer URLs ─────────────────────────────────────────

  describe('getExplorerTxUrl', () => {
    it('should build correct explorer URL', () => {
      const url = adapter.getExplorerTxUrl(baseSepolia, '0xabc');
      expect(url).toBe('https://sepolia.basescan.org/tx/0xabc');
    });

    it('should use production explorer for mainnet', () => {
      const url = adapter.getExplorerTxUrl(baseMainnet, '0xdef');
      expect(url).toBe('https://basescan.org/tx/0xdef');
    });
  });

  describe('getExplorerAddressUrl', () => {
    it('should build correct address URL', () => {
      const url = adapter.getExplorerAddressUrl(baseSepolia, '0xabc');
      expect(url).toBe('https://sepolia.basescan.org/address/0xabc');
    });
  });

  // ── Display name ──────────────────────────────────────────

  describe('getProfileDisplayName', () => {
    it('should append (test) for test profiles', () => {
      expect(adapter.getProfileDisplayName(baseSepolia)).toBe('Base Sepolia (test)');
    });

    it('should not append (test) for production', () => {
      expect(adapter.getProfileDisplayName(baseMainnet)).toBe('Base');
    });
  });

  // ── Finality policy ───────────────────────────────────────

  describe('getFinalityPolicy', () => {
    it('should return test policy for test profiles', () => {
      const policy = adapter.getFinalityPolicy(baseSepolia);
      expect(policy.minConfirmations).toBe(1);
      expect(policy.safeWaitMs).toBe(5000);
    });

    it('should return production policy for mainnet', () => {
      const policy = adapter.getFinalityPolicy(baseMainnet);
      expect(policy.minConfirmations).toBe(15);
      expect(policy.safeWaitMs).toBe(30000);
    });
  });

  // ── Facilitator URL ───────────────────────────────────────

  describe('getDefaultFacilitatorUrl', () => {
    it('should return test facilitator for test profiles', () => {
      expect(adapter.getDefaultFacilitatorUrl(baseSepolia)).toBe('https://x402.org/facilitator');
    });

    it('should return production facilitator for mainnet', () => {
      expect(adapter.getDefaultFacilitatorUrl(baseMainnet)).toBe(
        'https://api.cdp.coinbase.com/platform/v2/x402'
      );
    });
  });
});

describe('EVM Profiles', () => {
  it('should have 4 built-in profiles', () => {
    expect(evmProfiles).toHaveLength(4);
  });

  it('should have 2 test and 2 production profiles', () => {
    const test = evmProfiles.filter(p => p.mode === 'test');
    const prod = evmProfiles.filter(p => p.mode === 'production');
    expect(test).toHaveLength(2);
    expect(prod).toHaveLength(2);
  });

  it('each profile should have a valid CAIP-2 identifier', () => {
    for (const p of evmProfiles) {
      expect(p.caip2).toMatch(/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/);
    }
  });

  it('each profile should have at least one default asset', () => {
    for (const p of evmProfiles) {
      expect(p.defaultAssets.length).toBeGreaterThan(0);
    }
  });
});
