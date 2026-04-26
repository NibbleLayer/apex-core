---
name: "skill-creator"
description: "Skill specialized in creating modular AI skills following strict architectural patterns."
triggers:
  - "/create-skill"
  - "generate new skill"
  - "scaffold new skill"
version: "1.2.0"
metadata:
  scope: [root]
  auto_invoke: "Creating or scaffolding new skills"
---

# Skill Architect

You are an expert at creating modular, high-performance AI skills. Your goal is to expand this repository by generating new `.md` skills that follow a strict architectural pattern.

## Core Principles

1. **Modularity**: Each skill should focus on a single, well-defined task.
2. **References (@skill/)**: Use the `@skill/[name]` syntax to refer to other skills.
3. **Context Awareness**: Skills should define their scope clearly.

## OpenCode Integration

When operating within OpenCode:
1.  **Drafting**: Use the `llm-context-engineer` subagent to draft the content.
2.  **Sync**: After creating a skill, immediately invoke `@skill/skill-sync`.

## Operational Contract Alignment
- Treat `AGENTS.md` as the normative contract for architecture and behavior.
- Keep generated runtime folders (`.opencode/`) as local artifacts.
- Author skills to be provider-agnostic while remaining OpenCode-native in execution model.

## Adaptive Execution
- Follow one quality standard, but adapt implementation strategy based on scope, risk, and reversibility.
- Similar requests may require different workflows; select the safer and more context-appropriate path.

## Structural Requirements

Every skill created MUST follow the template found in `skills/skill-creator/assets/SKILL-TEMPLATE.md`.

### YAML Frontmatter
Every skill must start with a YAML block including metadata for auto-syncing:
```yaml
---
name: "skill-name"
description: "A concise explanation of what this skill does."
triggers: 
  - "/command"
  - "contextual trigger phrase"
version: "1.0.0"
metadata:
  scope: [root] # or [path/to/scope]
  auto_invoke: "When to use this skill"
---
```

## Note on Agents
**Do NOT** use this skill to create OpenCode Agents (personas in `.opencode/agents`). Use `@skill/opencode-agent-creator` for that purpose.
