import type { NetworkProfile } from '@nibblelayer/apex-network';

/**
 * Built-in EVM network profiles.
 *
 * These cover the most commonly used EVM networks for Apex.
 * Additional profiles can be registered at runtime via the registry.
 */
export const evmProfiles: NetworkProfile[] = [
  {
    id: 'base-sepolia',
    chainFamily: 'evm',
    displayName: 'Base Sepolia',
    description: 'Base testnet — free test ETH available from faucets. Recommended for development and evaluation.',
    caip2: 'eip155:84532',
    mode: 'test',
    defaultFacilitatorUrl: 'https://x402.org/facilitator',
    defaultAssets: [
      { symbol: 'ETH', name: 'Ether', address: 'native', decimals: 18, isNative: true },
    ],
    explorerBaseUrl: 'https://sepolia.basescan.org',
    requiredConfirmations: 1,
  },
  {
    id: 'base-mainnet',
    chainFamily: 'evm',
    displayName: 'Base',
    description: 'Base mainnet — real assets, real transactions. Built on OP Stack by Coinbase.',
    caip2: 'eip155:8453',
    mode: 'production',
    defaultFacilitatorUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    defaultAssets: [
      { symbol: 'ETH', name: 'Ether', address: 'native', decimals: 18, isNative: true },
    ],
    explorerBaseUrl: 'https://basescan.org',
    requiredConfirmations: 15,
  },
  {
    id: 'ethereum-sepolia',
    chainFamily: 'evm',
    displayName: 'Ethereum Sepolia',
    description: 'Ethereum testnet — free test ETH available from faucets.',
    caip2: 'eip155:11155111',
    mode: 'test',
    defaultFacilitatorUrl: 'https://x402.org/facilitator',
    defaultAssets: [
      { symbol: 'ETH', name: 'Ether', address: 'native', decimals: 18, isNative: true },
    ],
    explorerBaseUrl: 'https://sepolia.etherscan.io',
    requiredConfirmations: 1,
  },
  {
    id: 'ethereum-mainnet',
    chainFamily: 'evm',
    displayName: 'Ethereum',
    description: 'Ethereum mainnet — the original smart contract platform.',
    caip2: 'eip155:1',
    mode: 'production',
    defaultFacilitatorUrl: '',
    defaultAssets: [
      { symbol: 'ETH', name: 'Ether', address: 'native', decimals: 18, isNative: true },
    ],
    explorerBaseUrl: 'https://etherscan.io',
    requiredConfirmations: 15,
  },
];
