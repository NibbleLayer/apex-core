# @nibblelayer/apex-control-plane-core

Manifest builder and checksum utilities for the Apex control plane.

## Purpose

Provides public helpers for building, versioning, and diffing x402-compatible manifests. Used by the API manifest routes, the dashboard manifest preview, and external CI tools that need to validate or construct manifests.

## Install

```bash
pnpm add @nibblelayer/apex-control-plane-core
```

## Quick Start

```ts
import { buildManifest, computeChecksum, hasManifestChanged } from '@nibblelayer/apex-control-plane-core';
import type { ManifestInput } from '@nibblelayer/apex-control-plane-core';

const input: ManifestInput = {
  serviceId: 'svc_abc123',
  environment: { mode: 'test', network: 'eip155:1', facilitatorUrl: 'https://facilitator.example.com' },
  wallet: { address: '0x...', token: '0x...', network: 'eip155:1' },
  routes: [{
    route: { method: 'GET', path: '/api/weather', description: 'Weather data', enabled: true },
    priceRules: [{ scheme: 'exact', amount: '1000', token: '0x...', network: 'eip155:1', active: true }],
    discovery: null,
  }],
  eventsEndpoint: '/events',
  idempotencyEnabled: true,
  refreshIntervalMs: 60000,
  currentVersion: 0,
};

const manifest = buildManifest(input);
// => { serviceId, environment: 'test', version: 1, routes: {...}, checksum: '...', ... }

const checksum = computeChecksum(manifest);
const changed = hasManifestChanged(manifest, previousChecksum);
```

## API Reference

### `ManifestInput`

Input structure consumed by the manifest builder.

```ts
interface ManifestInput {
  serviceId: string;
  environment: {
    mode: 'test' | 'prod';
    network: string;
    facilitatorUrl: string;
  };
  wallet: {
    address: string;
    token: string;
    network: string;
  };
  routes: Array<{
    route: {
      method: HttpMethod;
      path: string;
      description?: string;
      enabled: boolean;
    };
    priceRules: Array<{
      scheme: PaymentScheme;
      amount: string;
      token: string;
      network: string;
      active: boolean;
    }>;
    discovery: {
      discoverable: boolean;
      category?: string;
      tags?: string[];
      inputSchema?: Record<string, unknown>;
      outputSchema?: Record<string, unknown>;
      published: boolean;
    } | null;
  }>;
  eventsEndpoint: string;
  idempotencyEnabled: boolean;
  refreshIntervalMs: number;
  currentVersion: number;
}
```

### `buildManifest(input: ManifestInput): ApexManifest`

Builds a complete, validated manifest from database-level input.

**Behavior:**

- Filters out routes where `route.enabled` is `false`.
- Filters out price rules where `active` is `false`.
- Constructs route keys as `"METHOD /path"` (e.g. `"GET /api/weather"`).
- Builds the `accepts` array from active price rules for each route.
- Adds a `payment-identifier` extension to route extensions when `idempotencyEnabled` is `true`.
- Adds a `bazaar` extension when discovery is `discoverable` and `published`.
- Increments the manifest version from `currentVersion`.
- Computes an SHA256 checksum of the canonical JSON (sorted keys) and attaches it to the manifest.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `input` | `ManifestInput` | Database-level configuration for the service |

**Returns:** `ApexManifest` — a complete manifest ready for distribution to SDK consumers.

### `computeChecksum(payload: unknown): string`

Computes an SHA256 hash of the canonical JSON representation of `payload`. Keys are sorted deterministically before hashing.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `payload` | `unknown` | Any JSON-serializable value |

**Returns:** `string` — hex-encoded SHA256 checksum.

### `hasManifestChanged(payload: unknown, previousChecksum: string): boolean`

Compares the current checksum of `payload` against a previously stored checksum.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `payload` | `unknown` | Any JSON-serializable value |
| `previousChecksum` | `string` | Previously stored hex-encoded checksum |

**Returns:** `boolean` — `true` if the checksum differs, indicating the payload has changed.

## Manifest Structure

The output of `buildManifest` is an `ApexManifest` object containing:

- **`serviceId`** — Identifies the service this manifest belongs to.
- **`environment`** — The target environment mode (`'test'` or `'prod'`).
- **`version`** — Monotonically increasing integer, incremented on each build.
- **`routes`** — Map of route keys (`"METHOD /path"`) to route definitions, each containing:
  - `accepts` — Array of accepted payment configurations built from active price rules.
  - `extensions` — Optional extensions (`payment-identifier`, `bazaar`).
- **`wallet`** — Wallet configuration for payment settlement.
- **`eventsEndpoint`** — Endpoint for payment event delivery.
- **`refreshIntervalMs`** — Suggested refresh interval for SDK consumers.
- **`checksum`** — SHA256 hash of the entire canonical manifest JSON.

## Dependencies

- `@nibblelayer/apex-contracts` — types and schemas

## License

[Apache-2.0](../../LICENSE)
