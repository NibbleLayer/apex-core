# Network Adapter Architecture Spec

## Status: Draft

**Objective**: Define a modular, adapter-based architecture for multi-network support that:
- Hides blockchain complexity from end users
- Supports multiple chain families (EVM, Solana, future)
- Makes network selection a first-class UX primitive (by name, not CAIP-2)
- Eliminates hardcoded facilitator URLs, token addresses, and explorer URLs
- Enables safe production vs test onboarding policies per profile

---

## 1. Current State Analysis

### Problems identified

| Problem | Location | Impact |
|---------|----------|--------|
| CAIP-2 raw string used as `network` field | schemas, DB, routes | No validation beyond regex, user must know CAIP-2 |
| Facilitator URLs hardcoded by mode | `environments.ts:38-42` | Only 2 supported, not extensible |
| No chain family abstraction | implicit EVM-only | Cannot add Solana without refactor |
| Token/asset refs are raw strings | pricing, wallet schemas | No validation per network |
| Network info scattered across scripts | `scripts/`, `quickstart-demo.sh` | Duplicated, inconsistent |
| Address validation is absent | wallets route | Any string accepted as address |

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────┐
│                    App Layer                         │
│  (CLI, Dashboard, API routes, SDK consumers)        │
├─────────────────────────────────────────────────────┤
│               Network Registry                       │
│  resolve(id) → NetworkProfile                       │
│  listByMode(test|production) → NetworkProfile[]     │
│  listByFamily(family) → NetworkProfile[]            │
├─────────────────────────────────────────────────────┤
│    ┌────────┐   ┌──────────┐   ┌──────────┐        │
│    │  EVM   │   │  Solana  │   │  Future  │   ...   │
│    │Adapter │   │ Adapter  │   │ Adapter  │        │
│    └────────┘   └──────────┘   └──────────┘        │
├─────────────────────────────────────────────────────┤
│               Profile Registry                      │
│  base-sepolia, base-mainnet, solana-devnet, ...     │
└─────────────────────────────────────────────────────┘
```

### Key Interfaces

#### `ChainAdapter` (family-level)

```typescript
interface ChainAdapter<TAddress = string> {
  readonly family: string; // 'evm' | 'solana' | ...

  // === Validation ===
  validateAddress(address: string, profile: NetworkProfile): boolean;
  validateAssetRef(ref: string, profile: NetworkProfile): boolean;
  validateTxHash(hash: string): boolean;

  // === Normalization ===
  normalizeAddress(address: string): TAddress;
  normalizeAssetRef(ref: string, profile: NetworkProfile): NormalizedAssetRef;

  // === UX Helpers ===
  getExplorerTxUrl(profile: NetworkProfile, txHash: string): string;
  getExplorerAddressUrl(profile: NetworkProfile, address: string): string;
  getProfileDisplayName(profile: NetworkProfile): string;

  // === Protocol Defaults ===
  getDefaultFacilitatorUrl(profile: NetworkProfile): string;
  getFinalityPolicy(profile: NetworkProfile): FinalityPolicy;
  getDefaultBlockExplorer(profile: NetworkProfile): string;
}
```

#### `NetworkProfile` (network-level)

```typescript
interface NetworkProfile {
  id: string;               // 'base-sepolia' | 'base-mainnet'
  chainFamily: string;      // 'evm' | 'solana'
  displayName: string;      // 'Base Sepolia'
  description?: string;
  caip2: string;            // 'eip155:84532'
  mode: 'test' | 'production';
  icon?: string;
  defaultFacilitatorUrl: string;
  defaultAssets: AssetRef[];
  explorerBaseUrl: string;
  requiredConfirmations: number;
  isDeprecated?: boolean;
}
```

#### `NormalizedAssetRef`

```typescript
interface NormalizedAssetRef {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  isNative: boolean;
  icon?: string;
}
```

#### `FinalityPolicy`

```typescript
interface FinalityPolicy {
  minConfirmations: number;
  averageBlockTimeMs: number;
  safeWaitMs: number;
}
```

---

## 3. Built-in Profiles

### EVM family

| Profile ID | Display Name | CAIP-2 | Mode | Facilitator |
|-----------|-------------|--------|------|-------------|
| `base-sepolia` | Base Sepolia | `eip155:84532` | test | `https://x402.org/facilitator` |
| `base-mainnet` | Base | `eip155:8453` | production | `https://api.cdp.coinbase.com/platform/v2/x402` |
| `ethereum-sepolia` | Ethereum Sepolia | `eip155:11155111` | test | `https://x402.org/facilitator` |
| `ethereum-mainnet` | Ethereum | `eip155:1` | production | TBD |

### Solana family (future)

| Profile ID | Display Name | CAIP-2 | Mode |
|-----------|-------------|--------|------|
| `solana-devnet` | Solana Devnet | `solana:8E9yCqQ5C7Q` | test |
| `solana-mainnet` | Solana | `solana:5eykt4UsFv8P8h` | production |

---

## 4. Package Structure

```
packages/
  network/
    package.json              ← @nibblelayer/apex-network
    src/
      adapter.ts              ← ChainAdapter interface
      profile.ts              ← NetworkProfile, AssetRef, FinalityPolicy types
      registry.ts             ← NetworkRegistry class

  network-evm/
    package.json              ← @nibblelayer/apex-network-evm
    src/
      evm-adapter.ts          ← EVM ChainAdapter implementation
      profiles.ts             ← Base Sepolia, Base Mainnet, Ethereum test/prod profiles

  network-solana/             ← future
    package.json              ← @nibblelayer/apex-network-solana
    src/
      solana-adapter.ts
      profiles.ts
```

### Dependency graph

```
@nibblelayer/apex-contracts
       ↑
@nibblelayer/apex-network  ← published
       ↑
@nibblelayer/apex-network-evm  ← published/optional

@nibblelayer/apex-api  →  depends on apex-network + apex-network-evm
@nibblelayer/apex-dashboard → depends on apex-network (types only)
```

---

## 5. Registry API

### Runtime usage

```typescript
import { NetworkRegistry } from '@nibblelayer/apex-network';

const registry = new NetworkRegistry();

// Register adapter (auto-discovers its built-in profiles)
registry.register(new EvmAdapter());

// Query
const profile = registry.getProfile('base-sepolia');
// → { id: 'base-sepolia', chainFamily: 'evm', displayName: 'Base Sepolia', ... }

const profiles = registry.listByMode('test');
// → [base-sepolia, ethereum-sepolia, solana-devnet]

const family = registry.getAdapter('evm');
family.validateAddress('0x...', profile);
family.getExplorerTxUrl(profile, '0xabc...');
// → 'https://sepolia.basescan.org/tx/0xabc...'
```

### Static profile lookup

```typescript
import { builtinProfiles } from '@nibblelayer/apex-network/profiles';

const profile = builtinProfiles['base-sepolia'];
console.log(profile.displayName); // 'Base Sepolia'
```

---

## 6. Migration Plan

### Phase 1 — Foundation (no breaking changes)
1. Create `packages/network/` with interfaces + types
2. Create `packages/network-evm/` with EVM adapter + profiles
3. Implement `NetworkRegistry`
4. Add unit tests for address validation, URL generation
5. Write profile data for Base Sepolia, Base Mainnet, Ethereum Sepolia, Ethereum Mainnet

### Phase 2 — API integration
1. Add `networkProfileId` as an alternative input in environment/wallet/pricing schemas
2. Resolve profile to CAIP-2 + facilitator URL via registry
3. Backward compatible: raw CAIP-2 still accepted
4. Add address validation using adapter before storing wallets
5. Remove hardcoded facilitator URLs from `environments.ts`

### Phase 3 — Onboarding & demo
1. Replace hardcoded network references in `scripts/quickstart-demo.sh`
2. Onboarding selects profile by name ("Base Sepolia")
3. Demo data generation uses profile registry for defaults

### Phase 4 — Dashboard & CLI
1. Dashboard environment form uses a profile dropdown
2. CLI `apex profile list` and `apex profile use` commands
3. Show network badge (test/production) clearly

---

## 7. Onboarding UX Simplification

### Before
User must:
1. Know CAIP-2 format: eip155:84532
2. Know facilitator URL: https://x402.org/facilitator
3. Know token address: 0x...
4. Enter all three as separate fields

### After
User selects "Base Sepolia" from a dropdown.

System resolves:
- CAIP-2: eip155:84532
- mode: test
- facilitator: https://x402.org/facilitator
- default asset: ETH
- explorer: https://sepolia.basescan.org

---

## 8. Open Questions

1. Should profiles be extensible at runtime (user adds custom RPC)? → Yes, Phase 5
2. Should `@nibblelayer/apex-network` be published to npm? → Yes, shared contracts
3. Should adapters be loaded dynamically or registered explicitly? → Explicit registration
4. Should there be a `NetworkProfile` DB table? → No, profiles are code; only resolved values stored

---

## 9. Future Extensions

- Custom RPC profiles via CLI/dashboard
- Multi-hop settlement across adapters
- Asset discovery per network
- Fee estimation per network
- Cross-chain settlement awareness
