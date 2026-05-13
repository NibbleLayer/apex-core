import { describe, it, expect } from 'vitest';
import { NetworkRegistry } from '@nibblelayer/apex-network';
import { registerEVM } from '../index.js';

describe('registerEVM', () => {
  it('should register EVM adapter and all profiles', () => {
    const registry = new NetworkRegistry();
    registerEVM(registry);

    expect(registry.families).toEqual(['evm']);
    expect(registry.profileCount).toBe(4);

    expect(registry.getProfile('base-sepolia')).toBeDefined();
    expect(registry.getProfile('base-mainnet')).toBeDefined();
    expect(registry.getProfile('ethereum-sepolia')).toBeDefined();
    expect(registry.getProfile('ethereum-mainnet')).toBeDefined();
  });

  it('should resolve profiles via registry', () => {
    const registry = new NetworkRegistry();
    registerEVM(registry);

    const profile = registry.getProfile('base-sepolia');
    const adapter = registry.getAdapter('evm')!;

    expect(adapter.validateAddress('0x1234567890abcdef1234567890abcdef12345678', profile!)).toBe(true);
  });
});
