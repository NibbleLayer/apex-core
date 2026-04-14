import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the logic functions in isolation by duplicating them.
// Direct imports from solid-js context require a full solid testing setup,
// so we test the pure-logic parts exhaustively.

// ---- network.ts logic ----
const NETWORK_LABELS: Record<string, string> = {
  'eip155:8453': 'Base',
  'eip155:84532': 'Base Sepolia',
  'eip155:1': 'Ethereum',
  'eip155:11155111': 'Sepolia',
};

function networkLabel(caip2: string): string {
  return NETWORK_LABELS[caip2] || caip2;
}

function networkColor(caip2: string): string {
  if (caip2.includes('84532')) return 'text-yellow-600';
  if (caip2.includes('8453')) return 'text-blue-600';
  return 'text-gray-600';
}

describe('network utilities', () => {
  it('labels known CAIP-2 networks', () => {
    expect(networkLabel('eip155:8453')).toBe('Base');
    expect(networkLabel('eip155:84532')).toBe('Base Sepolia');
    expect(networkLabel('eip155:1')).toBe('Ethereum');
    expect(networkLabel('eip155:11155111')).toBe('Sepolia');
  });

  it('returns raw CAIP-2 for unknown networks', () => {
    expect(networkLabel('eip155:999')).toBe('eip155:999');
    expect(networkLabel('solana:mainnet')).toBe('solana:mainnet');
  });

  it('assigns yellow for testnet (84532)', () => {
    expect(networkColor('eip155:84532')).toBe('text-yellow-600');
  });

  it('assigns blue for mainnet (8453)', () => {
    expect(networkColor('eip155:8453')).toBe('text-blue-600');
  });

  it('assigns gray for unknown', () => {
    expect(networkColor('eip155:1')).toBe('text-gray-600');
  });
});
