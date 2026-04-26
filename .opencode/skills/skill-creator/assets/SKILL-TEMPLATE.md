---
name: "{{SKILL_NAME}}"
description: "{{DESCRIPTION}}"
triggers:
  - "/{{COMMAND}}"
  - "{{NATURAL_LANGUAGE_TRIGGER}}"
version: "1.0.0"
metadata:
  scope: [{{SCOPE}}] # e.g., root, or directory path
  auto_invoke: 
    - "{{AUTO_INVOKE_ACTION}}"
  priority: medium # low | medium | high
---

# {{SKILL_NAME}}

## Context
<!-- Describe the specific scenario where this skill should be activated. -->
<!-- What problem does it solve for the AI or the User? -->

## Operational Contract Alignment
- Treat `AGENTS.md` as the authoritative contract for behavior and constraints.
- Keep runtime outputs (`.opencode/`) as local artifacts unless explicitly requested otherwise.
- Avoid vendor lock-in assumptions in skill logic; design for provider-agnostic execution through OpenCode.

## Guidelines
<!-- Operational instructions for the AI. -->
- Use @skill/{{RELATED_SKILL}} if applicable.
- Adhere to the core principles defined in @rules/root.

## Adaptive Execution
- Apply a unified standard, but adapt the strategy to context (risk, scope, reversibility, environment).
- For similar requests with different constraints, choose different workflows when justified.
- Prefer reversible operations and explain trade-offs when alternatives exist.

## Constraints
<!-- Safety boundaries and negative constraints. -->
- NEVER...
- ALWAYS...

## Examples
### Example 1: {{SCENARIO_1}}
**Input:** ...
**Output:** ...

## Related Capabilities
- @skill/{{OTHER_SKILL}}
- [[{{OBSIDIAN_LINK}}]]
