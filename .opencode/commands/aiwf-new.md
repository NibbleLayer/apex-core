---
description: Start a new work item
agent: system-architect
---

## Start New Work

### Session Context
!`aiwf status --json 2>/dev/null`

### Create Work
!`aiwf new $ARGUMENTS 2>&1`

Use `aiwf status --json` to understand bootstrap state, active work count, and the CLI-provided `next_action` before suggesting follow-up steps.

If creation succeeds:
1. Confirm the created work id and its initial state.
2. Note the auto-created ExecutionEnvelope — this is the governed execution unit for the first slice.
3. Treat the user arguments as the starting work description, not as permission to invent hidden requirements.
4. If the request is still vague, ask concise clarification questions about scope or success criteria.
5. Suggest the truthful next action reported by the CLI, usually `/aiwf-check`, `/aiwf-plan`, or `/aiwf-status`.

If active work already exists, explain that status first and ask whether the user wants to continue current work or intentionally create another work item in parallel.

If the command fails, explain the blocking issue directly from the CLI output.
