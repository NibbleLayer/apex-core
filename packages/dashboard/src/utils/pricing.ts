import type { CreatePriceRequest, NetworkProfileSummary } from '../api/types';
import { networkLabel } from './network';

export interface PricingTokenPreset {
  id: string;
  label: string;
  network: string;
  token: string;
}

/**
 * Legacy presets — hardcoded fallbacks when network profiles are not loaded.
 * Once profiles are available, prefer `getTokenPresetsFromProfiles()`.
 */
const FALLBACK_PRESETS: readonly PricingTokenPreset[] = [
  {
    id: 'test-usdc-base-sepolia',
    label: 'USDC test preset',
    network: 'eip155:84532',
    token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  {
    id: 'prod-usdc-base',
    label: 'USDC on Base',
    network: 'eip155:8453',
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
] as const;

/**
 * Derive token presets from network profiles fetched via the API.
 * Each non-native asset in a profile becomes a preset option.
 */
export function getTokenPresetsFromProfiles(
  profiles: NetworkProfileSummary[],
): PricingTokenPreset[] {
  return profiles.flatMap((profile) =>
    profile.defaultAssets
      .filter((asset) => !asset.isNative)
      .map((asset) => ({
        id: `${profile.id}-${asset.symbol.toLowerCase()}`,
        label: `${asset.symbol} ${profile.displayName}`,
        network: profile.caip2,
        token: asset.address,
      })),
  );
}

/**
 * Get presets — API-driven when profiles are available, fallback to legacy.
 */
export function getTokenPresets(
  profiles?: NetworkProfileSummary[],
): PricingTokenPreset[] {
  if (profiles && profiles.length > 0) {
    const derived = getTokenPresetsFromProfiles(profiles);
    if (derived.length > 0) return derived;
  }
  return [...FALLBACK_PRESETS] as PricingTokenPreset[];
}

export type PricingTokenPresetId = PricingTokenPreset['id'];

export function getPricingTokenPreset(
  id: PricingTokenPresetId,
  profiles?: NetworkProfileSummary[],
): PricingTokenPreset {
  const presets = getTokenPresets(profiles);
  const preset = presets.find((candidate) => candidate.id === id);
  if (!preset) {
    throw new Error(`Unknown pricing token preset: ${id}`);
  }
  return preset;
}

export function shortenTokenAddress(token: string): string {
  const normalized = token.trim();
  if (normalized.length <= 12) return normalized;
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
}

export function formatPricingTokenLabel(
  token: string,
  network: string,
  profiles?: NetworkProfileSummary[],
): string {
  const presets = getTokenPresets(profiles);
  const preset = presets.find(
    (candidate) =>
      candidate.token.toLowerCase() === token.trim().toLowerCase() &&
      candidate.network === network.trim(),
  );

  if (preset) return preset.label;
  return `${shortenTokenAddress(token)} on ${networkLabel(network, profiles)}`;
}

export function normalizeUsdAmountInput(input: string): string {
  const normalized = input.trim();
  if (!normalized) return '';

  const amount = normalized.startsWith('$')
    ? normalized.slice(1).trim()
    : normalized;
  if (!/^\d+(?:\.\d+)?$/.test(amount)) return '';
  if (Number(amount) <= 0) return '';

  return `$${amount}`;
}

export function buildPresetPricePayload(
  input: {
    amount: string;
    presetId: PricingTokenPresetId;
  },
  profiles?: NetworkProfileSummary[],
): CreatePriceRequest {
  const preset = getPricingTokenPreset(input.presetId, profiles);
  return {
    scheme: 'exact',
    amount: normalizeUsdAmountInput(input.amount),
    token: preset.token,
    network: preset.network,
  };
}
