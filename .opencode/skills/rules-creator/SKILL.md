---
name: "rules-creator"
description: "Skill specialized in scaffolding and defining AI rules within the AGENTS.md hierarchy."
triggers:
  - "/create-rules"
  - "define new nested rules"
  - "scaffold AGENTS.md"
version: "1.0.0"
metadata:
  scope: [root]
  auto_invoke: "Defining new rules or scaffolding AGENTS.md"
---

# RulesCreator

## Context
This skill is activated when the user needs to define a new rule profile (formerly known as agent profiles), either at the root level or within a specific sub-project (Nested Rules). It ensures that the rule definition follows the "Scope-Aware" architecture.

## Structural Requirements
Every rule profile created MUST follow the template found in `skills/rules-creator/assets/RULE-TEMPLATE.md`.

Refer to `skills/rules-creator/assets/REFERENCE-EXAMPLES.md` for practical examples of how to link rules and skills.

## OpenCode Integration

When operating within OpenCode:
1.  **Drafting**: Use the `llm-context-engineer` subagent to draft the content of the rules.
2.  **Sync**: After creating the rules, immediately invoke `@skill/rules-sync`.

## Operational Contract Alignment
- Rules created by this skill MUST keep `AGENTS.md` as the single operational contract.
- The contract must distinguish versioned source (`AGENTS.md`, `skills/`, `platforms/opencode/`) from local runtime artifacts (`.opencode/`, provider folders).
- Rules must keep provider choice as a local concern and avoid vendor-specific assumptions.

## Adaptive Execution
- Keep governance unified, but write execution instructions that allow context-sensitive strategies.
- Do not enforce one rigid workflow when risk, scope, or environment require a variant.

**Note on Bootstrapping**: The sync script (`skill-sync`) automatically detects missing `AGENTS.md` files at the root and bootstraps them using the standard template found in `skills/rules-creator/assets/RULE-TEMPLATE.md`. Manual copying is not required.

## Guidelines
- **Inheritance**: Always use `@rules/root` in nested rules.
- **Skill Injection**: Use `@skill/` to assign specific capabilities to the ruleset.
- **Directory Detection**: When creating a nested ruleset, identify the closest package descriptor to define the `Current Scope`.
- **Precedence**: Explicitly state that the local `AGENTS.md` takes precedence.


## Constraints
- **NEVER** include global build/test commands in a nested ruleset; only include commands relevant to the specific directory.
- **NEVER** duplicate the entire project context; focus exclusively on the local module's responsibilities.
- **ALWAYS** use the `@skill/` syntax for modular behaviors instead of writing long instructions directly in `AGENTS.md`.

## Examples
### Example 1: Creating a Nested Ruleset for a Backend module
**Input:** "Define a nested ruleset for the 'api/' directory."
**Output:**
```markdown
# AGENTS.md - Nested Context

## Project Overview
Current Scope: /api/
This ruleset is responsible for the REST API endpoints and database migrations.

## Build and Test Commands
- Test: `./test.sh` (or project-specific test command)
- Lint: `./lint.sh` (or project-specific lint command)

## Capabilities & Skills
- @skill/rules-creator (Self-management)
- @skill/security-audit (Endpoint protection)

## Inheritance & Delegation
- Parent: @rules/root
- Priority: High. Local definitions for /api/ override root context.
```

## Related
- @skill/skill-creator
