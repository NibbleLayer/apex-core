# Hosted Extension Points

> This document maps every extension point a hosted/managed Apex deployment needs to plug into the OSS codebase. The OSS repo provides hooks and scaffolding; the business repo provides implementations.

## Overview

Apex Core is designed for self-hosted single-organization use. A hosted/managed version requires these additional systems, each with clear plug-in points in the OSS codebase.

## 1. API Boundaries

### Rate Limiting
- **Hook**: `packages/api/src/middleware/rate-limit.ts`
- **OSS**: In-memory sliding window (single process)
- **Hosted**: Replace with Redis-backed store; apply `rateLimitPresets` to route groups
- **Application**: `app.use('/api/events/*', rateLimitMiddleware(rateLimitPresets.events))`

### Platform Admin Endpoints
- **Hook**: New route group `/platform/*` with dedicated auth middleware
- **OSS**: Not included (single-org doesn't need cross-tenant management)
- **Hosted**: Add `/platform/organizations`, `/platform/analytics`, `/platform/billing`
- **Auth**: Separate platform-admin token type (`apx_platform_...`)

### Organization Provisioning
- **Hook**: `packages/api/src/routes/organizations.ts` — `UNAUTHENTICATED_BOOTSTRAP_TOGGLE` env-var constant in `organizations.ts`
- **OSS**: Self-service org creation via env toggle
- **Hosted**: Remove toggle; add invite flow, plan assignment on creation, SSO/OAuth login

## 2. Multi-Tenant Isolation

### Current Model
- **Pattern**: Single-database, application-level isolation via `organizationId`
- **Every route**: `WHERE services.organizationId = ?` verified before data access
- **Auth middleware**: Resolves `organizationId` from API key → sets on Hono context

### PostgreSQL Row-Level Security (RLS)
- **Hook**: `packages/api/src/db/resolver.ts` — `getDb()` returns shared connection
- **Hosted**: Add `getTenantDb(orgId)` that sets `app.current_tenant` session variable
- **Migration**: Add `tenant_id` column to all tables + RLS policies
- **Complexity**: Large — touches every table and query

### Tenant Configuration
- **Hook**: `packages/api/src/routes/environments.ts` — hardcoded default facilitator URLs
- **Hosted**: Platform config table with per-tenant overrides (facilitator URL, webhook URL, etc.)

### Worker Context
- **Hook**: `packages/api/src/workers/webhook.ts` — queries without explicit tenant context
- **Analysis**: Workers inherit scope from triggering event's organization; safe but needs audit trail

## 3. Billing, RBAC, and Audit

### Audit Log
- **Hook**: `packages/api/src/middleware/audit-log.ts`
- **Schema**: `packages/core/src/db/schema/audit-log.ts`
- **OSS**: Logs mutation operations to console
- **Hosted**: Replace console.log with DB write to `audit_log` table
- **Migration**: `packages/core/drizzle/0007_audit_log.sql`

### RBAC — API Key Roles
- **Hook**: `packages/core/src/db/schema/api-keys.ts` — `role` column (admin|developer|viewer)
- **Permission helper**: `packages/api/src/services/permissions.ts` — `canPerform(role, action)`
- **OSS**: All keys default to 'admin'; no enforcement
- **Hosted**: Apply `canPerform()` checks in route handlers; add team membership model
- **Migration**: `packages/core/drizzle/0008_api_key_roles.sql`

### RBAC — Team Membership (Future)
- **Hook**: New `members` table referencing `organizations` + user identities
- **OSS**: Org access = having an API key
- **Hosted**: User accounts, SSO, invites, role management
- **Complexity**: Large — full identity system

### Billing — Usage Tracking
- **Hook**: `packages/api/src/services/usage-service.ts` — `trackUsage()` + `checkPlanLimit()`
- **Schema**: `packages/core/src/db/schema/usage-counters.ts`
- **OSS**: Logs to console; `checkPlanLimit()` always returns true
- **Hosted**: Increment DB counters per org/period/event_type; check against plan limits
- **Integration points**: `events.ts:13` (event ingestion), `settlements.ts` (settlement confirmation)

### Billing — Plan Enforcement (Future)
- **Hook**: All resource creation endpoints (services, routes, environments, SDK tokens)
- **OSS**: No limits
- **Hosted**: Check `checkPlanLimit(orgId, 'services')` before INSERT; return 402/403 on limit exceeded
- **Schema**: `plans` table + `organization_plans` join table

## 4. SDK Compatibility

### Boundary Test Suite
- **Test**: `packages/sdk-hono/test/boundary-contract.test.ts` — 15 tests
- **Coverage**: Manifest contract stability, unknown field handling, OSS/hosted URL parity, contracts export boundaries, no managed-specific imports

### SDK Design Principles
- SDK is environment-agnostic: no `if (isManaged)` code paths
- All configuration via `ApexClientConfig` (`apexUrl`, `token`)
- Token type auto-detection: `apex_` → legacy, `apx_sdk_` → signed manifest
- Zod safeParse strips unknown fields — forward compatible but silent on breaking changes

### Version Negotiation (Future)
- Add `manifestSchemaVersion` to `ApexManifest` type
- SDK warns on unknown top-level keys
- Hosted can evolve API without breaking older SDK versions

## Extension Point Summary

| Extension | OSS Hook | Hosted Implementation | Complexity |
|-----------|----------|----------------------|------------|
| Rate limiting | `rate-limit.ts` | Redis backend | Small |
| Platform admin | New `/platform/*` routes | Platform-admin auth | Medium |
| Org provisioning | `organizations.ts` toggle | SSO + plan assignment | Large |
| PostgreSQL RLS | `getDb()` resolver | `getTenantDb()` + RLS | Large |
| Tenant config | `environments.ts` defaults | Platform config table | Small |
| Audit log | `audit-log.ts` middleware | DB write | Small |
| API key roles | `api-keys.ts` role column | `canPerform()` checks | Medium |
| Team membership | New `members` table | Full identity system | Large |
| Usage tracking | `usage-service.ts` | DB counters + plan checks | Medium |
| Plan enforcement | All POST handlers | Limit checks before INSERT | Medium |
| SDK boundary | `boundary-contract.test.ts` | CI gate + version negotiation | Small |

## Recommended Implementation Order (Hosted)

1. Rate limiting (Small, immediate protection)
2. Audit log DB writes (Small, visibility)
3. API key role enforcement (Medium, access control)
4. Usage tracking + plan limits (Medium, billing foundation)
5. Platform admin endpoints (Medium, management)
6. PostgreSQL RLS (Large, data isolation)
7. Team membership + SSO (Large, enterprise identity)
