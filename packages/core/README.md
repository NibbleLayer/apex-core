# @nibblelayer/apex-persistence

Internal database schema and persistence layer for Apex.

## Purpose

Defines the PostgreSQL schema using [Drizzle ORM](https://orm.drizzle.team) and provides migration infrastructure.

## Schema Overview

| Table | Purpose |
|-------|---------|
| `organizations` | Root tenant entity |
| `services` | API/service definitions |
| `environments` | Test/production deployment targets |
| `routes` | HTTP route definitions |
| `price_rules` | Pricing per route |
| `wallet_destinations` | Blockchain wallet configurations |
| `api_keys` | Organization API keys (hashed) |
| `sdk_tokens` | Service-scoped SDK tokens |
| `payment_events` | Payment lifecycle events |
| `settlements` | Financial settlement records |
| `webhook_endpoints` | Outgoing webhook configurations |
| `webhook_deliveries` | Delivery attempt log |
| `discovery_metadata` | Public API catalog metadata |
| `service_domains` | Custom domain verifications |
| `audit_log` | Compliance audit trail |
| `usage_counters` | Billing counters |

## Migrations

```bash
# Generate a new migration after schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Push schema directly (development only)
pnpm db:push
```

## Not Published

This is an internal package, not published to npm.
