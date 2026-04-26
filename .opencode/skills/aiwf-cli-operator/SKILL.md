---
name: "aiwf-cli-operator"
description: "Use the current AIWF CLI as the control plane for bootstrap, work lifecycle, sync, status, and validation flows."
version: "2.0.0"
metadata:
  scope: [root]
  auto_invoke: "When an agent needs to operate the AIWF CLI or machine API"
triggers:
  - "operate aiwf cli"
  - "run aiwf commands"
  - "aiwf workflow"
  - "aiwf governance"
---

# AIWF CLI Operator

## Purpose
Operate the current AIWF CLI through the active cyclical work model and the documented command surface.

## Decision Rules
- Prefer documented commands from `setup/README.md` and active wrappers under `platforms/opencode/commands/`.
- Prefer top-level wrappers for guided loop flow: `aiwf new|check|plan|step|done`.
- Prefer `aiwf work ...` for explicit lifecycle control, automation, or disambiguation.
- Prefer `aiwf status --json` before advising on current or next execution.
- Prefer `--json` when supported and machine-readable output helps downstream steps.
- Use `--target <path>` when operating outside the current repository root.
- Validate after mutation with the narrowest real command.

## Current Command Surface

### Bootstrap and status
```bash
aiwf init
aiwf status --json
aiwf doctor
```

### Guided work wrappers
```bash
aiwf new <description>
aiwf check
aiwf plan [work-id]
aiwf step [N] [--status ...]
aiwf done [work-id]
```

### Explicit work lifecycle
```bash
aiwf work create|list|show|transition
aiwf work evidence|decide|stats|log|next
aiwf work settle|evolve|abandon
aiwf work doctor|export|migrate-state
```

### Sync and compile
```bash
aiwf sync all|skills|rules|opencode
aiwf compile
aiwf pre-pr
```

## Common Loop
1. `aiwf init`
2. `aiwf status --json`
3. `aiwf new <description>`
4. `aiwf plan [work-id]` when the next execution slice needs explicit framing
5. `aiwf step [N] [--status ...]`
6. `aiwf work evidence ...` and `aiwf work decide ...` when evidence or decisions must be explicit
7. `aiwf check`
8. Repeat from status, plan, or step as needed
9. `aiwf done [work-id]` only when the work objective is actually satisfied

Use `aiwf work ...` commands when the wrapper path is ambiguous, multiple work items exist, or explicit evidence, findings, or decisions must be recorded.

## Guidance Rules
- Treat `aiwf new|plan|step|done` as wrappers over the current work lifecycle.
- If multiple active work items exist, require an explicit work selector.
- If current or next execution advice depends on state, read `aiwf status --json` first.
- If evidence is needed, prefer real work/evidence commands or `aiwf step` options that match the current state.
- If findings change approach or scope, prefer `aiwf work decide ...` before continuing.
- If sync is needed after skill edits, use `aiwf sync skills` or the repository sync wrapper when the native tool is unavailable.

## Validation Heuristics
- After editing `skills/*/SKILL.md` -> `aiwf sync skills`
- After editing `AGENTS.md` hierarchy or rule metadata -> `aiwf sync rules`
- After editing OpenCode runtime source -> `aiwf sync opencode` then `aiwf doctor`
- Before PR readiness checks -> `aiwf pre-pr`
- When work state is unclear -> `aiwf status --json`

## Constraints
- NEVER recommend nonexistent commands or undocumented legacy flows.
- NEVER frame the workflow as plan-first ceremony.
- NEVER omit `--target` when operating on another workspace.
- ALWAYS choose the narrowest command family that matches the task.
- ALWAYS align advice with the current work lifecycle and actual CLI output.

## Examples
```bash
# Bootstrap and inspect state
aiwf init
aiwf status --json

# Start and frame next execution
aiwf new "align EDD workflow"
aiwf plan --json

# Explicit work inspection and next-step selection
aiwf work show
aiwf work next

# Step progress, evidence, and verification
aiwf step 1 --status in_progress
aiwf work evidence add ...
aiwf check
aiwf work decide ...
aiwf step 1 --status complete

# Sync after skill edits
aiwf sync skills
```

## Related
- `@skill/system-sync`
- `@skill/skill-sync`
- `@skill/edd-workflow`
- `@skill/brainstorm`
