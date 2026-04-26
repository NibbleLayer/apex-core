---
scope: "packages/core"
type: "rules"
role: "Internal Persistence Package"
priority: high
metadata:
  system: "aiwf"
  execution_context: "package"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Rules: @nibblelayer/apex-persistence

## Context & Responsibility

Database schema definitions, migrations, and connection exports for PostgreSQL via Drizzle ORM.

## Operational Contract

- **Internal Package**: NOT published to npm. Used by `@nibblelayer/apex-api` and tests.
- **Schema Authority**: Single source of truth for all database tables, relations, and indexes.
- **Migrations**: Managed via Drizzle Kit (`pnpm db:generate`, `pnpm db:migrate`).

## Boundaries

| Export | Consumers |
|--------|-----------|
| `db/schema/*` | API routes, test setup |
| `db/index.ts` | Schema re-exports |
| `drizzle/*` | Migration SQL and snapshots |

## Constraints

- NEVER import from application packages (`@nibblelayer/apex-api`, `@nibblelayer/apex-dashboard`)
- Schema changes require migration generation
- All timestamps MUST use `withTimezone: true`
