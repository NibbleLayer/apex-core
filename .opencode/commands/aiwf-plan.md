---
description: Plan the next execution envelope for the active work item
agent: system-architect
---

## Work Planning

### Session Context
!`aiwf status --json 2>/dev/null`

### Pre-flight Check
!`aiwf check 2>&1`

If validation reports blocking findings, address those before advancing to prototyping.

### Plan
!`aiwf plan $ARGUMENTS 2>&1`

Use `aiwf status --json` to confirm active work state.

If planning succeeds:
- Explain which work item was moved forward.
- Note the active ExecutionEnvelope and its objective.
- If no active envelope exists, one was auto-created — guide the user to refine its objective.
- Suggest `/aiwf-step` when execution should begin.
- Use `aiwf work envelope` commands for precise envelope management when needed.

If planning fails, explain whether bootstrap is incomplete, no active work, or work id not found.
