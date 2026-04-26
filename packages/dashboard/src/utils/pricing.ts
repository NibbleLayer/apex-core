import type { CreatePriceRequest } from '../api/types';
import { networkLabel } from './network';

export interface PricingTokenPreset {
  id: 'test-usdc-base-sepolia' | 'prod-usdc-base';
  label: string;
  network: string;
  token: string;
}

export const PRICING_TOKEN_PRESETS: readonly PricingTokenPreset[] = [
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

export type PricingTokenPresetId = PricingTokenPreset['id'];

export function getPricingTokenPreset(id: PricingTokenPresetId): PricingTokenPreset {
  const preset = PRICING_TOKEN_PRESETS.find((candidate) => candidate.id === id);
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

export function formatPricingTokenLabel(token: string, network: string): string {
  const preset = PRICING_TOKEN_PRESETS.find(
    (candidate) => candidate.token.toLowerCase() === token.trim().toLowerCase() && candidate.network === network.trim(),
  );

  if (preset) return preset.label;
  return `${shortenTokenAddress(token)} on ${networkLabel(network)}`;
}

export function normalizeUsdAmountInput(input: string): string {
  const normalized = input.trim();
  if (!normalized) return '';

  const amount = normalized.startsWith('$') ? normalized.slice(1).trim() : normalized;
  if (!/^\d+(?:\.\d+)?$/.test(amount)) return '';
  if (Number(amount) <= 0) return '';

  return `$${amount}`;
}

export function buildPresetPricePayload(input: {
  amount: string;
  presetId: PricingTokenPresetId;
}): CreatePriceRequest {
  const preset = getPricingTokenPreset(input.presetId);
  return {
    scheme: 'exact',
    amount: normalizeUsdAmountInput(input.amount),
    token: preset.token,
    network: preset.network,
  };
}
