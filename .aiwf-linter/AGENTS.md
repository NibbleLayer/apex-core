---
scope: ".aiwf-linter"
type: "rules"
role: "AIWF Linter Configuration"
priority: medium
metadata:
  system: "aiwf"
  execution_context: "repository"
  doc_audience: "agent"
  lifecycle: "steady_state"
---

# Rules: .aiwf-linter

## Context & Responsibility

This scope governs validation of AIWF governance artifacts. It defines what constitutes valid governance files and how linting failures are handled.

## AGENTS.md Validation Rules

Every `AGENTS.md` file MUST contain valid YAML frontmatter with these required fields:

| Field | Required | Allowed Values |
|-------|----------|---------------|
| `scope` | YES | Dot-path matching directory location (e.g., `setup`, `governance/contract`) |
| `type` | YES | `rules`, `skill`, `config` |
| `role` | YES | Free-form string describing the file's purpose |
| `priority` | YES | `critical`, `high`, `medium`, `low` |
| `metadata.system` | YES | Must be `aiwf` |
| `metadata.execution_context` | YES | `repository` |
| `metadata.doc_audience` | YES | `agent` |
| `metadata.lifecycle` | YES | `bootstrap`, `steady_state`, `deprecated` |

### Lint Checks for AGENTS.md

1. **FM-001**: Frontmatter exists and is valid YAML
2. **FM-002**: All required fields are present
3. **FM-003**: `scope` matches the file's directory path
4. **FM-004**: `priority` is one of the allowed values
5. **FM-005**: `metadata.system` equals `aiwf`

## SKILL.md Validation Rules

Skill files MUST follow the SKILL.md template pattern:

- Located under `skills/<skill-name>/SKILL.md` or `.opencode/skills/<skill-name>/SKILL.md`
- Must contain frontmatter with `scope`, `type: "skill"`, `role`
- Must declare `metadata.scope` matching the skill's domain
- Must contain sections: Identity, Trigger, Input, Output, Constraints

### Lint Checks for SKILL.md

1. **SK-001**: File location matches expected pattern
2. **SK-002**: Frontmatter declares `type: "skill"`
3. **SK-003**: All required sections are present
4. **SK-004**: References to other skills/files are valid paths

## Rule Validation

- Rule files MUST declare their `scope` and optionally a `parent` scope
- Scopes MUST form a valid tree rooted at `/`
- Cross-scope references MUST be resolvable within the repository

## Reference Integrity

- All file paths referenced in governance artifacts MUST exist
- All skill references (`@skill/name`) MUST resolve to a valid SKILL.md
- All agent references MUST resolve to a valid agent definition
- Broken references are lint errors with severity `high`

## Path Consistency

- Paths in governance files MUST use forward slashes
- Paths MUST be relative to the repository root
- Paths MUST NOT contain `..` segments
- Paths MUST NOT be absolute

## Failure Policy

| Severity | Policy |
|----------|--------|
| `critical` | Blocks commit. Must be fixed immediately. |
| `high` | Blocks commit on protected paths (AGENTS.md, SKILL.md). Warns on other paths. |
| `medium` | Warns. Does not block commit. |
| `low` | Informational. Logged only. |

### Protected Paths

Lint failures on these paths block commits regardless of severity:

- `AGENTS.md` (any directory)
- `**/SKILL.md`
- `governance/**`
- `.aiwf-linter/**`
