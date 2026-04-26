---
scope: "packages/dashboard"
type: "rules"
role: "Dashboard Application"
priority: high
metadata:
  system: "aiwf"
  execution_context: "package"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Rules: @nibblelayer/apex-dashboard

## Context & Responsibility

Self-hosted admin dashboard built with SolidJS and Vite. Provides the seller-facing UI for managing services, routes, pricing, and monitoring settlements.

## Operational Contract

- **Internal Package**: NOT published to npm. Part of the self-hosted distribution.
- **API Proxy**: Dev server proxies `/api` to `localhost:3000`.
- **Auth**: Stores API key in `localStorage`.

## Boundaries

| Route/Page | Purpose |
|------------|---------|
| `/login` | API key entry |
| `/` | Dashboard overview |
| `/services` | Service list and creation |
| `/services/:id` | Service detail (environments, routes, wallets, domains, webhooks) |
| `/services/:id/onboarding` | Setup wizard for new services |

## Constraints

- NEVER store secrets other than the admin API key
- NEVER make raw SQL queries — all data via API client
- camelCase property names expected from API responses
