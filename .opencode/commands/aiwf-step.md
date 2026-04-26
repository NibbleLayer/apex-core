---
description: Execute a step within the active execution envelope
agent: system-architect
---

## Work Step

### Session Context
!`aiwf status --json 2>/dev/null`

### Pre-flight Check
!`aiwf check 2>&1`

If validation reports blocking findings, address those before recording step evidence.

### Current Work Step / Evidence
!`aiwf step $ARGUMENTS 2>&1`

When helping with implementation:
1. Confirm which work item and execution envelope are active.
2. The envelope tracks the current execution slice — keep guidance aligned with its objective.
3. If verification evidence is needed, suggest `aiwf check` to run sensors and capture findings.
4. When a step is verified, the active envelope may auto-complete.
5. If the envelope objective is satisfied, suggest completing it: `aiwf work envelope complete <id>`
6. If findings reveal issues, record them: `aiwf work envelope findings <id> --finding "..." --severity warning|blocking`
7. Delegate non-trivial implementation to specialized agents.

If no active envelope, suggest `/aiwf-plan` to create one.
