---
scope: "setup"
type: "rules"
role: "Setup & Bootstrap Rules"
priority: high
metadata:
  system: "aiwf"
  execution_context: "repository"
  doc_audience: "agent"
  lifecycle: "bootstrap"
---

# Rules: setup

## Context & Responsibility

This scope governs initial repository configuration, bootstrap sequences, and environment setup for apex-core.

## Bootstrap Artifacts

- Bootstrap answers and state are persisted at `.aiwf/session/bootstrap.*`
- After bootstrap completion, this scope transitions lifecycle from `bootstrap` to `steady_state`
- Bootstrap MUST NOT be re-run unless explicitly requested by the user

## Transfer Contract

- `setup/transfer_contract.json` defines which artifacts may be transferred out of the repository
- Transfer categories: `transferable`, `restricted`, `never_transfer`
- Agents MUST consult the transfer contract before any export/publish operation
- Violations of transfer boundaries are T2-high minimum

## User-Facing Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `pnpm dev` | Initial environment setup and service startup | `pnpm dev` |
| `scripts/stop.sh` | Graceful service shutdown | `./scripts/stop.sh` |
| `scripts/e2e-test.sh` | End-to-end test execution | `./scripts/e2e-test.sh` |
| `scripts/release-verify.sh` | Pre-release verification | `./scripts/release-verify.sh` |
| `scripts/verify-compose.sh` | Docker Compose configuration validation | `./scripts/verify-compose.sh` |
| `scripts/verify-public-packages.sh` | Public package boundary verification | `./scripts/verify-public-packages.sh` |

## Seed & Initialization

- The API auto-seeds on first boot. The optional `pnpm seed` command can be used to manually create an organization if auto-seed is disabled.
- Seed operations are idempotent by design
- Running seed against a populated database is safe but will log a warning

## Environment Variables

Required environment variables (see `compose.yaml` for full reference):

| Variable | Purpose | Required At |
|----------|---------|------------|
| `DATABASE_URL` | PostgreSQL connection string | Runtime |

### Environment Rules

- NEVER commit `.env` or `.env.local` files
- Environment variables MUST NOT appear in audit logs or transfer artifacts
- Default values for local development are defined in `compose.yaml`
- Production values MUST be injected via CI/CD secrets or orchestration platform

## Bootstrap Sequence

1. Verify runtime prerequisites (Node.js version from `.nvmrc`, pnpm)
2. Install dependencies (`pnpm install`)
3. Build workspace (`pnpm build`)
4. Start infrastructure (`pnpm dev` — uses direct container runtime with compose fallback)
5. Run database migrations
6. Seed initial data
7. Verify health endpoints
8. Record bootstrap completion in `.aiwf/session/bootstrap.complete.json`
