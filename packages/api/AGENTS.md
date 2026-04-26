---
scope: "packages/api"
type: "rules"
role: "API Application"
priority: high
metadata:
  system: "aiwf"
  execution_context: "package"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Rules: @nibblelayer/apex-api

## Context & Responsibility

Self-hosted REST API application built with Hono. Serves the dashboard and SDK consumers.

## Operational Contract

- **Internal Package**: NOT published to npm. Part of the self-hosted distribution.
- **Authentication**: API key (Bearer) for admin routes, scoped SDK token for SDK routes.
- **Database**: PostgreSQL via Drizzle ORM. All financial operations MUST use transactions.
- **Serialization**: Returns camelCase JSON (no middleware transformation).

## Boundaries

| Boundary | Rule |
|----------|------|
| Public surface | `/health`, `/auth/*` |
| Admin surface | `/services/*`, `/routes/*`, `/events/*`, `/settlements/*`, `/webhooks/*`, `/domains/*` |
| SDK surface | `/sdk/*`, `/events` (with scoped token) |
| Internal | Workers (webhook delivery) run alongside the API server |

## Dependencies

- `@nibblelayer/apex-contracts` — schemas and types
- `@nibblelayer/apex-persistence` — database schema and connection
- `@nibblelayer/apex-control-plane-core` — manifest construction
