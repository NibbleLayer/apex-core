---
scope: "packages/contracts"
type: "rules"
role: "Public Contracts Package"
priority: critical
metadata:
  system: "aiwf"
  execution_context: "package"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Rules: @nibblelayer/apex-contracts

## Context & Responsibility

Public schemas, types, and validation rules shared across all Apex integrations. This is the **source of truth** for the public API contract.

## Operational Contract

- **Published Package**: Published to npm as `@nibblelayer/apex-contracts`.
- **Versioning**: Follows semver. Breaking changes require major version bump.
- **Schema Authority**: All API request/response shapes, SDK manifest types, and event payloads are defined here.
- **No Runtime Dependencies**: Should not depend on internal packages.

## Boundaries

| Export | Consumers |
|--------|-----------|
| `schemas/*` | API routes (validation), SDK (manifest parsing), Dashboard (form validation) |
| `types/*` | TypeScript consumers across all packages |
| `manifest-envelope.js` | SDK (signed manifest verification) |

## Constraints

- NEVER import from internal packages (`@nibblelayer/apex-api`, `@nibblelayer/apex-persistence`)
- NEVER expose internal-only types (database IDs, internal state machines)
- All schemas MUST use camelCase property names
