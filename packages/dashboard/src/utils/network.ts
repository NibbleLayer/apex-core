import type { NetworkProfileSummary } from '../api/types';

/**
 * Fallback labels used when network profiles are not yet loaded.
 * These are the same display names used in the built-in EVM profiles
 * and should match what the API returns.
 */
const FALLBACK_LABELS: Record<string, string> = {
  'eip155:8453': 'Base',
  'eip155:84532': 'Base Sepolia',
  'eip155:1': 'Ethereum',
  'eip155:11155111': 'Sepolia',
};

/**
 * Get a human-readable label for a CAIP-2 network identifier.
 *
 * When profiles are available (fetched from the API), uses the profile's
 * displayName. Falls back to built-in labels for known chains, then the
 * raw CAIP-2 string for unknown chains.
 */
export function networkLabel(
  caip2: string,
  profiles?: NetworkProfileSummary[],
): string {
  if (profiles && profiles.length > 0) {
    const profile = profiles.find((p) => p.caip2 === caip2);
    if (profile) return profile.displayName;
  }
  return FALLBACK_LABELS[caip2] || caip2;
}

/**
 * Get a Tailwind color class for a network's mode.
 *
 * Production → blue, test → yellow, unknown → gray.
 */
export function networkColor(
  caip2: string,
  profiles?: NetworkProfileSummary[],
): string {
  if (profiles && profiles.length > 0) {
    const profile = profiles.find((p) => p.caip2 === caip2);
    if (profile) {
      return profile.mode === 'production' ? 'text-blue-600' : 'text-yellow-600';
    }
  }
  // Legacy fallback for known chains when profiles aren't loaded
  // Order matters: 84532 also contains 8453, so check testnet first
  if (caip2.includes('84532')) return 'text-yellow-600';
  if (caip2.includes('8453')) return 'text-blue-600';
  return 'text-gray-600';
}
