# @nibblelayer/apex-api

Self-hosted REST API for the Apex control plane.

## Purpose

Provides the backend for:
- **Dashboard**: Organization, service, route, pricing, and settlement management
- **SDK**: Manifest distribution, route registration, and event ingestion
- **Webhooks**: Delivery lifecycle with retry and observability

## Architecture

Built with [Hono](https://hono.dev) (ultra-fast web framework) and [Drizzle ORM](https://orm.drizzle.team).

```
Dashboard (SolidJS) ──▶ API (Hono) ──▶ PostgreSQL
SDK (Hono) ──────────▶ API (Hono) ──▶ PostgreSQL
```

## Key Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `POST /auth/login` | Exchange API key for organization info | API key |
| `GET /auth/me` | Current identity | Bearer |
| `POST /services` | Create a service | Bearer |
| `POST /services/:id/environments` | Create environment | Bearer |
| `POST /services/:id/routes` | Create route | Bearer |
| `POST /routes/:id/pricing` | Set pricing | Bearer |
| `POST /services/:id/sdk-tokens` | Create scoped SDK token | Bearer |
| `GET /sdk/manifest` | Fetch signed manifest | SDK token |
| `POST /sdk/register` | Register route candidates | SDK token |
| `POST /events` | Ingest payment events | SDK token |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ALLOW_UNAUTHENTICATED_ORGANIZATION_BOOTSTRAP` | No | `false` | Allow public org creation (dev only) |

## Development

```bash
# From repo root
pnpm dev:api
```

## Not Published

This is an internal application, not published to npm. It ships as part of the self-hosted Docker Compose stack.
