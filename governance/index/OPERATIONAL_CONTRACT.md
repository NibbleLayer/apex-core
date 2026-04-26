---
scope: "governance/contract"
type: "rules"
role: "Operational Contract"
priority: critical
metadata:
  system: "aiwf"
  execution_context: "repository"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Operational Contract: apex-core

Canonical governance contract for all agent and human operations within this repository.

## Risk Tiers

Every change MUST be classified into exactly one risk tier before execution. Classification determines which Definition Gates apply.

| Tier | Scope | Gate Requirement |
|------|-------|-----------------|
| **T0-low** | Documentation changes, README updates, comment-only edits | No gate |
| **T1-medium** | Feature additions, refactors, new test files, non-breaking modifications | DG-1 + DG-2 |
| **T2-high** | Breaking API changes, dependency additions/removals, migration changes, CI modifications | DG-1 + DG-2 + DG-3 + Manual review |
| **T3-critical** | Security changes, authentication/authorization logic, financial settlement logic, release operations, secret management | All T2 gates + DG-4 + DG-5 + Explicit user approval |

### Tier Classification Rules

- IF change modifies only Markdown or comment text -> T0-low
- IF change adds new exported symbols without removing existing ones -> T1-medium
- IF change removes or alters existing exported signatures -> T2-high minimum
- IF change touches `packages/contracts/` or any file containing settlement/auth logic -> T3-critical
- IF uncertain between two tiers -> classify at the HIGHER tier

## Definition Gates

Quality gates that MUST pass before merge. Agents MUST verify applicable gates before declaring work complete.

| Gate | Command | Scope | Failure Policy |
|------|---------|-------|---------------|
| **DG-1** | `pnpm build` | Full workspace | Zero errors. Warnings are acceptable but must be noted. |
| **DG-2** | `pnpm test` | Full workspace | Zero failures. Skipped tests must be documented. |
| **DG-3** | `pnpm typecheck` | Public packages: `contracts`, `control-plane-core`, `sdk-hono` | Zero type errors on public API surface. |
| **DG-4** | `pnpm pack:verify` | Public packages | Verifies no private-package imports in public packages. |
| **DG-5** | `pnpm compose:verify` | Docker Compose | Validates compose configuration and service connectivity. |

### Gate Application by Tier

- T0-low: No gates required
- T1-medium: DG-1, DG-2
- T2-high: DG-1, DG-2, DG-3, Manual review
- T3-critical: DG-1, DG-2, DG-3, DG-4, DG-5, Explicit user approval

## Exception Policy

Exceptions provide temporary bypass for specific Definition Gates. They are NOT policy changes.

### Exception Structure

Every exception registered in `.aiwf/exceptions.json` MUST contain:

```json
{
  "id": "EX-NNN",
  "reason": "Human-readable justification",
  "scope": "DG-N | tier:TN | package:@scope/name",
  "created_at": "ISO-8601",
  "expires_at": "ISO-8601",
  "created_by": "agent | human"
}
```

### Exception Rules

- Exceptions MUST be registered in `.aiwf/exceptions.json` before bypassing a gate
- Every exception MUST have: `id`, `reason`, `scope`, `created_at`, `expires_at`
- Expired exceptions (`expires_at` < current time) are automatically invalid
- T3-critical operations CANNOT proceed with any active exceptions — no exceptions allowed for T3
- Exceptions MUST NOT exceed 72-hour lifetime
- At most 3 active exceptions may exist simultaneously

## GitHub Operations Policy

### Tool Selection

1. **Default**: `gh` CLI for ALL GitHub write operations
2. **Fallback**: API-based tools ONLY when `gh` does not support the required operation
3. **Prohibition**: NEVER use web-based GitHub operations manually

### Repository Integrity

- NEVER create, fork, or recreate repositories unless explicitly instructed by the user
- NEVER work against separate, temporary, or test repositories
- ALL work MUST occur within the current repository context
- Repository-destructive actions (force push, branch deletion, tag deletion) require explicit user confirmation via natural language

### Branch Policy

- Feature branches: `feat/<short-description>`
- Fix branches: `fix/<short-description>`
- Governance branches: `gov/<short-description>`
- Branch names MUST be lowercase, hyphen-separated, under 60 characters

## Merge Discipline

| Strategy | When to Use | Justification Required |
|----------|------------|----------------------|
| **Merge commit** (default) | All standard PRs | None — this is the default |
| **Squash** | Fixup commits, typo fixes, single-logical-change PRs with messy history | Commit message must describe full logical change |
| **Rebase** | Single-commit PRs where linear history is valuable | Must note why linear history matters for this PR |

### Merge Prerequisites

- All applicable Definition Gates MUST pass
- At least one review approval (for T2+ and T3)
- No merge conflicts
- Branch is up to date with base

## Public Package Boundary

### Boundary Rules

1. Public packages MUST NOT import from private packages
   - `@nibblelayer/apex-contracts` -> no private imports
   - `@nibblelayer/apex-control-plane-core` -> no private imports
   - `@nibblelayer/apex-hono` -> no private imports
2. Private packages MAY import from public packages
3. Public packages MAY import from other public packages

### Identification Markers

- Public packages are identified by `publishConfig.access: "public"` in their `package.json`
- The `files` field in `package.json` controls what gets published to npm
- Any package without `publishConfig.access: "public"` is considered private/internal

### Boundary Verification

- DG-4 (`pnpm pack:verify`) enforces this boundary at gate level
- Boundary violations are T2-high minimum violations
- Boundary violations in released packages are T3-critical incidents

## Financial & Settlement Safety

Given that apex-core handles x402 payment protocol logic:

- ANY change to settlement calculation, balance tracking, or payment flow -> T3-critical
- Test coverage for settlement logic MUST NOT decrease
- Financial precision changes MUST be reviewed by a human with domain knowledge
- Amount representations MUST use integer-based types (e.g., cents, basis points) — never floating point

## Audit Trail

- All T2+ and T3 operations are logged to `.aiwf/audit/`
- Audit entries MUST include: timestamp, operation, tier, agent, result
- Audit logs MUST NOT be transferred out of the development environment
- Audit logs are governed by the transfer contract in `setup/transfer_contract.json`
