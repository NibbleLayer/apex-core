# @nibblelayer/apex-contracts

Shared Zod schemas and TypeScript types for the Apex x402 payment protocol.

## Purpose

This is the **source of truth** for all public API contracts in the Apex ecosystem. Every request shape, response type, manifest structure, and event payload used by the API, SDK, and dashboard is defined, validated, and exported from this package.

## Install

```bash
pnpm add @nibblelayer/apex-contracts
```

## Exports

| Entry Point | Description |
|---|---|
| `@nibblelayer/apex-contracts` | TypeScript type definitions |
| `@nibblelayer/apex-contracts/schemas` | Zod validation schemas |

## Types

Exported from `@nibblelayer/apex-contracts`.

| Type | Description |
|---|---|
| `Organization` | Organization entity (`id`, `name`, `slug`, `createdAt`) |
| `Service` | Service entity scoped to an organization (`id`, `organizationId`, `name`, `slug`, `createdAt`) |
| `Environment` | Environment configuration (`id`, `serviceId`, `mode`, `network`, `facilitatorUrl`, `walletId`, `eventsEndpoint`, `idempotencyEnabled`, `refreshIntervalMs`, `createdAt`) |
| `EnvironmentMode` | `'test' \| 'prod'` — environment mode literal |
| `WalletDestination` | Wallet address for receiving payments (`id`, `organizationId`, `label`, `address`, `token`, `network`, `active`, `createdAt`) |
| `Route` | API route definition (`id`, `serviceId`, `method`, `path`, `description`, `enabled`) |
| `HttpMethod` | HTTP method literal (`'GET'`, `'POST'`, `'PUT'`, `'DELETE'`, `'PATCH'`, etc.) |
| `PriceRule` | Pricing rule linking a route to an environment (`id`, `routeId`, `environmentId`, `scheme`, `amount`, `token`, `network`, `active`, `createdAt`) |
| `PaymentScheme` | Payment scheme literal (`'exact'`, etc.) |
| `DiscoveryMetadata` | Route discoverability metadata (`id`, `routeId`, `environmentId`, `discoverable`, `category`, `tags`, `inputSchema`, `outputSchema`, `published`, `createdAt`) |
| `Settlement` | Settlement record (`id`, `serviceId`, `routeId`, `type`, `status`, `amount`, `token`, `network`, `txHash`, `createdAt`, `settledAt`) |
| `SettlementStatus` | Settlement status literal |
| `PaymentEvent` | Payment lifecycle event envelope |
| `PaymentEventType` | Event type literal (`'required'`, `'verified'`, `'settled'`, `'failed'`, `'replay'`) |
| `PaymentEventPayload` | Payload structure for payment events |
| `ApexManifest` | Complete x402 manifest structure |
| `ManifestRoute` | Route entry within a manifest |
| `ManifestRouteAccepts` | Accepted payment configuration for a manifest route |
| `ManifestRouteExtensions` | Extensions applied to a manifest route |
| `ManifestWallet` | Wallet configuration within a manifest |

## Schemas

Exported from `@nibblelayer/apex-contracts/schemas`.

| Schema | Description |
|---|---|
| `caip2Network` | CAIP-2 network identifier validator |
| `organizationSchema` | Full `Organization` validator |
| `createOrganizationSchema` | Organization creation payload validator |
| `serviceSchema` | Full `Service` validator |
| `createServiceSchema` | Service creation payload validator |
| `environmentSchema` | Full `Environment` validator |
| `createEnvironmentSchema` | Environment creation payload validator |
| `walletSchema` | Full `WalletDestination` validator |
| `createWalletSchema` | Wallet creation payload validator |
| `routeSchema` | Full `Route` validator |
| `createRouteSchema` | Route creation payload validator |
| `priceRuleSchema` | Full `PriceRule` validator |
| `createPriceRuleSchema` | Price rule creation payload validator |
| `discoverySchema` | Full `DiscoveryMetadata` validator |
| `createDiscoverySchema` | Discovery creation payload validator |
| `createWebhookSchema` | Webhook creation payload validator |
| `settlementSchema` | Full `Settlement` validator |
| `paymentEventSchema` | Full `PaymentEvent` validator |
| `paymentEventPayloadSchema` | Payment event payload validator |
| `paymentEventTypeSchema` | Payment event type enum validator |
| `apexManifestSchema` | Complete x402 manifest validation schema |

## Usage

```ts
// Types
import type {
  Organization,
  Service,
  Environment,
  Route,
  ApexManifest,
} from '@nibblelayer/apex-contracts';

// Schemas
import {
  apexManifestSchema,
  createServiceSchema,
  priceRuleSchema,
} from '@nibblelayer/apex-contracts/schemas';

// Validate at runtime
const result = apexManifestSchema.safeParse(payload);
if (!result.success) {
  console.error(result.error.issues);
}

// Parse and type-narrow
const parsed = createServiceSchema.parse(input);
// parsed is now typed as the creation payload
```

## License

[Apache-2.0](../../LICENSE)
