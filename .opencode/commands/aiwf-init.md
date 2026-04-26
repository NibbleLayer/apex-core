---
description: Bootstrap AIWF governance and then confirm status
agent: system-architect
---

## AIWF Init

### Session Context
!`aiwf status --json 2>/dev/null`

### Bootstrap
!`aiwf init 2>&1`

This command bootstraps the repository so the work workflow can run.
After running it, use `aiwf status --json` or `aiwf status` to confirm readiness and repeat the CLI's actual next action.

If bootstrap succeeds, explain that the repository is ready for work-oriented slash commands such as `/aiwf-new`, `/aiwf-check`, `/aiwf-plan`, `/aiwf-step`, `/aiwf-done`, or `/aiwf-status`.
If bootstrap is already complete or fails, report that honestly from the CLI output without inventing extra lifecycle stages.

### Verify
!`aiwf status 2>&1`
