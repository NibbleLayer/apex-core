# Publication Readiness

`apex-core` is not public-ready until all 10 gates pass. Green build/test output is required evidence, but not sufficient without security, publishing, discovery, domain, and business-boundary readiness.

## Checklist

| Gate | Required evidence | Status |
| --- | --- | --- |
| Gate 0 — Safety/runtime correctness | `pnpm build`; `pnpm test`; `pnpm e2e`; `pnpm compose:verify`; fail-closed x402 runtime behavior | `complete` |
| Gate 1 — Token + signed manifest security | scoped tokens; signed manifests; invalid manifest rejection; no secret leakage in publishable artifacts. Gate 1 validation passed: build, typecheck, persistence/api/hono tests, E2E covered, compose:verify, pack:verify. | `complete` |
| Gate 2 — One-line SDK | `apex()` integration test; `APEX_TOKEN`/`APEX_URL` path; SDK tarball verified by `pnpm pack:verify`. Gate 2A validation passed: build, typecheck, apex-hono tests 94/94, E2E covered, pack:verify. | `complete` |
| Gate 3 — Dashboard-first onboarding | onboarding flow evidence; preset validation; advanced-mode separation; actionable setup errors. Gate 3 validation passed: dashboard tests 74/74, dashboard build, build, typecheck, E2E covered, compose:verify. | `complete` |
| Gate 4 — Route registry + auto-registration | route candidate registration; draft-only auto-registration; dashboard approval; drift detection. Gate 4 validation passed: SDK route registrar tests 100/100 apex-hono suite, API tests 15/15, dashboard tests 76/76, E2E covered, build, typecheck, compose:verify. | `complete` |
| Gate 5 — Publish/version workflow | audited publish workflow; version rules; changelog rules; `pnpm pack:verify`. Gate 5 validation passed: release:metadata, pack:verify, release:verify --skip-compose-check, compose:verify. | `complete` |
| Gate 6 — Discovery/Bazaar operations | metadata validation; listing preview; indexing status; state model evidence. Gate 6 validation passed: discovery quality/status/preview tests, dashboard build, build, typecheck, E2E covered, compose:verify. | `complete` |
| Gate 6.5 — Domain identity & DNS verification | verified DNS domains; ownership proof records; manifest/dashboard domain status. Gate 6.5 validation passed: DNS verification unit tests, service domain API/dashboard, manifest verifiedDomains, E2E covered, build, typecheck, compose:verify. | `complete` |
| Gate 7 — Events/settlements/webhooks hardening | paymentIdentifier required in events; settlement transition rules + PATCH endpoint; signed webhooks with replay protection (timestamp+deliveryId); exponential backoff; delivery visibility API/dashboard; docs/WEBHOOK_SECURITY.md. Gate 7 validation passed: build, typecheck, E2E covered (42 assertions total), compose:verify. | `complete` |
| Gate 8 — Business repo readiness | audit log middleware + table; rate limiting middleware + presets; API key roles (admin/developer/viewer) + permission helper; usage counter scaffolding + plan limit stubs; SDK boundary contract tests (15/15); docs/HOSTED_EXTENSION_POINTS.md. Gate 8 validation passed: build 6/6, typecheck, unit tests 83/83, Gate 8 tests 66/66, E2E covered (42 assertions total), 10 migrations (0000-0009). | `complete` |

## E2E Test Evidence

The E2E suite grows incrementally with each gate. The current suite contains **42 assertions** covering all implemented gates (0–8). Historical gate validations referenced smaller counts because the suite was smaller at the time.

## Current state

This repo is **publication-ready**. All 10 gates (0-8) pass with evidence. See HOSTED_EXTENSION_POINTS.md for managed deployment guidance.

## EDD execution loop

Work -> ExecutionEnvelope -> Evidence -> Findings -> Decision -> Next gate.
