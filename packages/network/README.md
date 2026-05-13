# @nibblelayer/apex-network

Chain adapter interfaces and network profile registry for multi-network support.

## Purpose

Defines the modular adapter architecture that enables Apex to support multiple blockchain families (EVM, Solana, and future chains) through a single unified interface. This package contains the **abstract contracts** — the actual chain implementations live in separate adapter packages.

## Install

```bash
pnpm add @nibblelayer/apex-network
```

## Exports

| Entry Point | Description |
|---|---|
| `@nibblelayer/apex-network` | `ChainAdapter`, `NetworkProfile`, `NetworkRegistry`, and related types |
| `@nibblelayer/apex-network/adapter` | `ChainAdapter` interface |
| `@nibblelayer/apex-network/profile` | `NetworkProfile`, `NormalizedAssetRef`, `FinalityPolicy` |
| `@nibblelayer/apex-network/registry` | `NetworkRegistry` class |

## Key Types

### ChainAdapter

Family-level implementation for validation, normalization, explorer URL generation, and protocol defaults. Each chain family (EVM, Solana, etc.) implements this interface.

```typescript
interface ChainAdapter {
  readonly family: string;
  validateAddress(address: string, profile: NetworkProfile): boolean;
  validateTxHash(hash: string): boolean;
  normalizeAddress(address: string, profile: NetworkProfile): string;
  getExplorerTxUrl(profile: NetworkProfile, txHash: string): string;
  getDefaultFacilitatorUrl(profile: NetworkProfile): string;
  getFinalityPolicy(profile: NetworkProfile): FinalityPolicy;
}
```

### NetworkProfile

Concrete network instance (e.g., "Base Sepolia") with metadata, default assets, explorer URLs, and facilitator configuration.

```typescript
interface NetworkProfile {
  id: string;               // 'base-sepolia'
  chainFamily: string;      // 'evm'
  displayName: string;      // 'Base Sepolia'
  caip2: string;            // 'eip155:84532'
  mode: 'test' | 'production';
  defaultFacilitatorUrl: string;
  defaultAssets: NormalizedAssetRef[];
  explorerBaseUrl: string;
  requiredConfirmations: number;
}
```

### NetworkRegistry

Central registry for adapters and profiles. Registers adapters and their built-in profiles, resolves profiles by ID, and lists by mode or family.

```typescript
const registry = new NetworkRegistry();
registry.registerAdapter(new EvmAdapter());
registry.registerProfiles(evmProfiles);

const profile = registry.getProfile('base-sepolia');
const adapter = registry.getAdapter('evm');
```

## Adapter Packages

This package defines the interfaces. Implementations live in separate packages:

| Package | Chain Family |
|---------|-------------|
| `@nibblelayer/apex-network-evm` | EVM chains (Base, Ethereum, etc.) |
| `@nibblelayer/apex-network-solana` | Solana *(future)* |

## Architecture

See the [Network Adapter Architecture Spec](../docs/architecture/NETWORK_ADAPTER_SPEC.md) for the full design.
