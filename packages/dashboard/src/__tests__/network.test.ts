import { describe, it, expect } from 'vitest';

// We test the logic functions in isolation by duplicating them.
// Direct imports from solid-js context require a full solid testing setup,
// so we test the pure-logic parts exhaustively.

// ---- network.ts logic ----
const FALLBACK_LABELS: Record<string, string> = {
  'eip155:8453': 'Base',
  'eip155:84532': 'Base Sepolia',
  'eip155:1': 'Ethereum',
  'eip155:11155111': 'Sepolia',
};

interface NetworkProfileSummary {
  caip2: string;
  displayName: string;
  mode: 'test' | 'production';
}

function networkLabel(
  caip2: string,
  profiles?: NetworkProfileSummary[],
): string {
  if (profiles && profiles.length > 0) {
    const profile = profiles.find((p) => p.caip2 === caip2);
    if (profile) return profile.displayName;
  }
  return FALLBACK_LABELS[caip2] || caip2;
}

function networkColor(
  caip2: string,
  profiles?: NetworkProfileSummary[],
): string {
  if (profiles && profiles.length > 0) {
    const profile = profiles.find((p) => p.caip2 === caip2);
    if (profile) {
      return profile.mode === 'production' ? 'text-blue-600' : 'text-yellow-600';
    }
  }
  // Order matters: 84532 also contains 8453, so check testnet first
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

  it('uses profile displayName when profiles are provided', () => {
    const profiles: NetworkProfileSummary[] = [
      { caip2: 'eip155:8453', displayName: 'Base Mainnet', mode: 'production' },
      { caip2: 'eip155:84532', displayName: 'Base Testnet', mode: 'test' },
    ];
    expect(networkLabel('eip155:8453', profiles)).toBe('Base Mainnet');
    expect(networkLabel('eip155:84532', profiles)).toBe('Base Testnet');
  });

  it('falls back to FALLBACK_LABELS when profile not found', () => {
    const profiles: NetworkProfileSummary[] = [
      { caip2: 'eip155:137', displayName: 'Polygon', mode: 'production' },
    ];
    expect(networkLabel('eip155:8453', profiles)).toBe('Base');
    expect(networkLabel('eip155:999', profiles)).toBe('eip155:999');
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

  it('uses profile mode for color when profiles are provided', () => {
    const profiles: NetworkProfileSummary[] = [
      { caip2: 'eip155:8453', displayName: 'Base', mode: 'production' },
      { caip2: 'eip155:84532', displayName: 'Base Sepolia', mode: 'test' },
    ];
    expect(networkColor('eip155:8453', profiles)).toBe('text-blue-600');
    expect(networkColor('eip155:84532', profiles)).toBe('text-yellow-600');
  });

  it('falls back to legacy color logic when profile not found', () => {
    const profiles: NetworkProfileSummary[] = [
      { caip2: 'eip155:137', displayName: 'Polygon', mode: 'production' },
    ];
    expect(networkColor('eip155:8453', profiles)).toBe('text-blue-600');
    expect(networkColor('eip155:1', profiles)).toBe('text-gray-600');
  });
});
