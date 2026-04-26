---
scope: "packages/control-plane-core"
type: "rules"
role: "Public Control Plane Core"
priority: high
metadata:
  system: "aiwf"
  execution_context: "package"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Rules: @nibblelayer/apex-control-plane-core

## Context & Responsibility

Public manifest construction helpers for control-plane consumers (dashboard, API, external tools).

## Operational Contract

- **Published Package**: Published to npm as `@nibblelayer/apex-control-plane-core`.
- **Purpose**: Build, version, and diff x402-compatible manifests.
- **Consumers**: API manifest routes, dashboard manifest preview, external CI tools.

## Dependencies

- `@nibblelayer/apex-contracts` — types and schemas
