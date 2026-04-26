---
scope: "packages/sdk-hono"
type: "rules"
role: "Public SDK Package"
priority: critical
metadata:
  system: "aiwf"
  execution_context: "package"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Rules: @nibblelayer/apex-hono

## Context & Responsibility

Public Hono SDK for integrating x402 payment middleware into seller APIs. The primary integration surface for external developers.

## Operational Contract

- **Published Package**: Published to npm as `@nibblelayer/apex-hono`.
- **One-Line Integration**: `app.use('/api/*', await apex())`
- **Scoped Tokens**: Uses `apx_sdk_*` tokens, not admin API keys.
- **Manifest Refresh**: Auto-refreshes manifest from control plane.

## Boundaries

| Export | Purpose |
|--------|---------|
| `apex()` | One-line middleware factory |
| `createApexClient()` | Advanced client with event listeners |
| `RouteRegistrar` | Auto-register route candidates |

## Dependencies

- `@nibblelayer/apex-contracts` — manifest types and schemas
- `@x402/*` — x402 protocol implementation

## Constraints

- NEVER import from internal packages
- MUST validate signed manifests when `useSignedManifest: true`
- MUST fail closed (allow traffic) if manifest fetch fails after cache expiry
