---
description: Settle completed work and close any active envelopes
agent: system-architect
---

## Settle Work

### Session Context
!`aiwf status --json 2>/dev/null`

### Pre-flight Check
!`aiwf check 2>&1`

If validation reports blocking findings, settling is blocked until they are resolved.

### Settle
!`aiwf done $ARGUMENTS 2>&1`

When settling:
1. Confirm the active work item and its envelope completion status.
2. Any active envelope will be auto-completed on settle.
3. Review the envelope summary — all should be completed or intentionally skipped.
4. If evidence or verification is missing, explain what's blocking.

If settling succeeds, confirm the work id and suggest creating the next work item.
