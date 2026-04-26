---
description: Show current AIWF status including envelope context
agent: system-architect
---

## AIWF Status

### Status
!`aiwf status --json 2>&1`

Treat this command as the authoritative slash-command view over `aiwf status --json`.
Summarize the current repository state in this order:
1. Bootstrap state
2. Active work count
3. Primary active work details when there is exactly one
4. Active execution envelope (if any) and its objective/status
5. Recent transitions only if they help explain the present state
6. The CLI-provided `next_action`

Keep guidance honest to the current payload.
Do not refer to fields or lifecycle concepts that are not present in `aiwf status --json`.
If multiple active work items exist, tell the operator to choose one explicitly before planning or settling.
If no active work exists, suggest starting with `/aiwf-new` or the underlying `aiwf new <description>` command.
When envelopes are active, note the envelope id and suggest envelope management commands if the objective needs refinement.
