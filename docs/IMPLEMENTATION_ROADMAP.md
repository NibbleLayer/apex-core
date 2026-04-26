# Implementation Roadmap

Public OSS readiness requires every publication gate below to pass. Build/test green is necessary evidence, not sufficient readiness.

## Gate 0 — Safety/runtime correctness

Objective: Ensure local, CI, and container runtimes fail predictably and never mask payment or infrastructure failures.

Exit criteria:
- `pnpm build`, `pnpm test`, `pnpm e2e`, and `pnpm compose:verify` pass reliably.
- E2E setup failures fail the run instead of being skipped or masked.
- Docker/Podman database connectivity is deterministic.
- Production x402 enforcement fails closed when unavailable or misconfigured.
Current status: `complete`

## Gate 1 — Token + signed manifest security

Objective: Protect SDK/runtime configuration with scoped tokens and signed manifest verification.

Exit criteria:
- SDK tokens are scoped, revocable, and environment-bounded.
- `/sdk/manifest` returns signed manifest envelopes.
- SDK rejects invalid, expired, or unsigned manifests by default.
- Publishable packages do not leak internal secrets or server-only configuration.
Current status: `complete`

## Gate 2 — One-line SDK

Objective: Provide a credible one-line seller API integration path.

Exit criteria:
- `apex()` high-level SDK export is documented and tested.
- `APEX_TOKEN` and `APEX_URL` configure runtime integration.
- SDK integrates route pricing and manifest fetch with minimal app code.
- Package tarball verification proves publish-safe SDK contents.
Current status: `complete`

## Gate 3 — Dashboard-first onboarding

Objective: Make setup and monetization configuration possible from dashboard-first flows.

Exit criteria:
- Onboarding wizard covers org, API key, network, token, and facilitator setup.
- Prices are shown in user-friendly units with advanced raw fields hidden.
- Test and production setup paths are distinct.
- Dashboard exposes actionable validation errors.
Current status: `complete`

## Gate 4 — Route registry + auto-registration

Objective: Keep SDK-discovered routes and dashboard-approved monetization state synchronized.

Exit criteria:
- SDK can submit route candidates safely.
- Auto-registration creates draft-only route records.
- Dashboard approval publishes monetized routes.
- Runtime heartbeat detects stale SDKs and route drift.
Current status: `complete`

## Gate 5 — Publish/version workflow

Objective: Make public package publication auditable, repeatable, and version-safe.

Exit criteria:
- `pnpm pack:verify` passes for every publishable package.
- Versioning and changelog rules are explicit.
- Publish workflow is reviewed and auditable.
- Internal packages remain unpublished and excluded from public tarballs.
Current status: `complete`

## Gate 6 — Discovery/Bazaar operations

Objective: Prepare marketplace/discovery metadata and indexing operations for public use.

Exit criteria:
- Discovery metadata has validation and quality checks.
- Listing preview matches published metadata.
- Draft, review, published, and rejected states are defined.
- Bazaar indexing status and failure modes are visible.
Current status: `complete`

## Gate 6.5 — Domain identity & DNS verification

Objective: Bind public service identity to verified domains before discovery or publication trust claims.

Exit criteria:
- Domain ownership verification flow is documented and implemented.
- DNS proof records are validated before public listing.
- Verified domains are linked to org/service identity.
- Domain verification status is exposed in dashboard and manifests.
Current status: `complete`

## Gate 7 — Events/settlements/webhooks hardening

Objective: Make payment lifecycle data reliable, traceable, and safe for downstream automation.

Exit criteria:
- Payment events include `routeId`, `requestId`, and `paymentIdentifier`.
- Settlement status transitions are explicit and test-covered.
- Webhooks are signed, replay-protected, and retry-safe.
- Failure states are observable from API/dashboard.
Current status: `complete`

## Gate 8 — Business repo readiness

Objective: Keep the OSS boundary clean while enabling future managed/enterprise repository integration.

Exit criteria:
- Hosted-compatible API boundaries are documented.
- Multi-tenant isolation hooks are identified.
- Billing, RBAC, and audit extension points are explicit.
- SDK compatibility tests protect the OSS/managed boundary.
Current status: `complete`

## Next execution focus

All gates complete. Final pre-release checklist: `pnpm release:verify` full suite, changelog review, tag v0.1.0.
