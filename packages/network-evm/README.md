# @nibblelayer/apex-network-evm

EVM chain adapter and built-in network profiles for Apex.

## Purpose

Provides the EVM `ChainAdapter` implementation with:

- **Address validation**: validates 0x-prefixed hex addresses
- **Transaction hash validation**: validates 0x-prefixed 64-char hex hashes
- **Asset normalization**: resolves native (ETH) and ERC-20 token references
- **Explorer URLs**: generates block explorer links for transactions and addresses
- **Finality policies**: test (1 confirmation, 5s) and production (15 confirmations, 30s)
- **4 built-in profiles**: Base Sepolia, Base Mainnet, Ethereum Sepolia, Ethereum Mainnet

## Install

```bash
pnpm add @nibblelayer/apex-network-evm
```

## Exports

| Entry Point | Description |
|---|---|
| `@nibblelayer/apex-network-evm` | `EvmAdapter`, `evmProfiles`, `registerEVM()` |
| `@nibblelayer/apex-network-evm/evm-adapter` | `EvmAdapter` class |
| `@nibblelayer/apex-network-evm/profiles` | `evmProfiles` array |

## Usage

### Register everything

```typescript
import { NetworkRegistry } from '@nibblelayer/apex-network';
import { registerEVM } from '@nibblelayer/apex-network-evm';

const registry = new NetworkRegistry();
registerEVM(registry);

// Now available:
registry.getProfile('base-sepolia');
registry.getAdapter('evm');
```

### Use the adapter directly

```typescript
import { EvmAdapter } from '@nibblelayer/apex-network-evm';
import { builtinProfiles } from '@nibblelayer/apex-network/profiles';

const adapter = new EvmAdapter();
const sepolia = builtinProfiles['base-sepolia'];

adapter.validateAddress('0x1234567890abcdef1234567890abcdef12345678', sepolia);
// → true

adapter.getExplorerTxUrl(sepolia, '0xabc...');
// → 'https://sepolia.basescan.org/tx/0xabc...'
```

## Built-in Profiles

| Profile ID | Display Name | CAIP-2 | Mode | Facilitator |
|-----------|-------------|--------|------|-------------|
| `base-sepolia` | Base Sepolia | `eip155:84532` | test | `https://x402.org/facilitator` |
| `base-mainnet` | Base | `eip155:8453` | production | `https://api.cdp.coinbase.com/platform/v2/x402` |
| `ethereum-sepolia` | Ethereum Sepolia | `eip155:11155111` | test | `https://x402.org/facilitator` |
| `ethereum-mainnet` | Ethereum | `eip155:1` | production | *(TBD)* |

## Architecture

See the [Network Adapter Architecture Spec](../docs/architecture/NETWORK_ADAPTER_SPEC.md) for the full design.
