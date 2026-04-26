---
description: Run sensors, capture evidence, and record findings in the active envelope
agent: system-architect
---

## AIWF Check

### Session Context
!`aiwf status --json 2>/dev/null`

### Validation
!`aiwf check 2>&1`

Evidence and findings flow:
1. Sensors run and evidence is attached to the active work.
2. If an execution envelope is active, findings are auto-recorded from sensor results.
3. Blocking findings should halt execution — address them before continuing.
4. Info findings confirm progress is on track.

If validation passes, confirm checks and restate the CLI-backed next action.
If validation fails, explain the reported issues and suggest the smallest corrective action.
