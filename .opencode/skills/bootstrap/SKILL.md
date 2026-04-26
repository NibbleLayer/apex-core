---
name: "bootstrap"
description: "Keeps AIWF bootstrap intake bounded so Python can finalize canonical bootstrap state deterministically."
triggers:
  - "/bootstrap"
  - "aiwf init"
  - "running bootstrap intake"
version: "1.0.0"
metadata:
  scope: [root]
  auto_invoke:
    - "Running AIWF init or refining bootstrap intake behavior"
  priority: high
---

# bootstrap

## Context
Use this skill during AIWF bootstrap intake when the agent needs to collect intent without becoming the final authority for repository setup state.

## Operational Contract Alignment
- Treat `.aiwf-governance/` as the canonical governance root and `.aiwf/` as runtime/local state.
- Treat `.aiwf/session/bootstrap.answers.json` as Python-owned canonical output.
- Treat `.aiwf/session/bootstrap.proposal.json` as optional bounded intake, never as the final authority.

## Guidelines
- Ask only the minimum questions needed to understand project name, primary objective, and any unusual risk.
- Keep the interview bounded, concise, and free of unnecessary governance jargon.
- If structured output is useful, write only the allowed proposal keys: `project_name`, `primary_objective`, `risk_tier`, `recommended_skills`, and `repository_state.target_dir_name`.
- End with practical next steps once the bounded intake is captured.

## Constraints
- NEVER claim authority over bootstrap completion or canonical answers finalization.
- NEVER invent unsupported bootstrap keys or freeform config structures.
- ALWAYS defer final completeness and validation to Python.

## Examples
### Example 1: First-run repository bootstrap
**Input:** "Help me initialize AIWF for this repo."
**Output:** Ask a few focused questions, write a bounded proposal if needed, and leave canonical finalization to Python.

## Related Capabilities
- @skill/rules-creator
- @skill/skill-creator
