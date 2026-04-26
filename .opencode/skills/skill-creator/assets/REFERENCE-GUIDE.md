# Reference System Standards (@skill & @agent)

This guide defines how to link modular components within the AI Workflows ecosystem.

## 1. Skill References (@skill/)
Used to inject specific functional logic into an agent or another skill.

- **Direct Injection**: `@skill/security-audit` -> Injects the full logic of the security skill.
- **Conditional Reference**: `If [condition] use @skill/refactor` -> Teaches the AI when to switch behaviors.
- **Chaining**: A skill can contain `@skill/other-skill` to create complex toolchains.

## 2. Rules Delegation (@agent/)
Used in `AGENTS.md` to define responsibility boundaries and delegation.

- **Root Access**: `@agent/root` refers to the root `AGENTS.md`.
- **Peer Reference**: `@agent/backend` (from a frontend nested agent) to understand API contracts.

## 3. Formatting Rules
- References must be on their own line or clearly delimited.
- The path is always relative to the `/skills` or root directories, but using the `@` prefix simplifies it for the LLM context.

## 4. Nested Precedence
1. **Local `AGENTS.md`**: The source of truth for the current directory.
2. **Referenced Skills (@skill/)**: Explicitly loaded behaviors.
3. **Global `AGENTS.md`**: Only used for project-wide conventions (e.g., git hooks).

## 5. Skill YAML Structure
All skills must follow this YAML frontmatter standard to ensure compatibility with `@skill/skill-sync`.

```yaml
---
name: "SkillName"
description: "Concise description of the skill."
triggers:
  - "/command"
  - "natural language trigger"
version: "1.0.0"
metadata:
  # Scope: defines which AGENTS.md files this skill applies to.
  # Values: directory path relative to root (e.g. 'backend/api'), or 'root'.
  scope: [root] 
  
  # Auto-invoke: describes when the AI should automatically call this skill.
  # Can be a string or a list of strings.
  auto_invoke: "Action description"
---
```

## 6. Rules YAML Structure (AGENTS.md)
Rules definition files (`AGENTS.md`) use a different metadata structure to define hierarchy and scope.

```yaml
---
scope: "/path/to/scope/"    # Directory this ruleset controls
type: "rules"               # rules | agent | skill
parent: "/"                 # Parent scope (for nested rules)
priority: "high"            # critical | high | medium | low
---
```

## 7. OpenCode Agent Structure (`platforms/opencode/agent/` -> `.opencode/agents/`)
These are executable personas used by the System Architect. They are **not** skills.

Use `@skill/opencode-agent-creator` to generate these automatically using the "OpenCode Agent" template.

## 8. Operational Contract Notes
- Source of truth is `AGENTS.md`, `skills/`, and `platforms/opencode/`.
- Runtime artifacts (`.opencode/`) should stay out of version control.
- Skills must be provider-agnostic and rely on OpenCode as execution layer, not as model vendor lock-in.
- Unified standards apply, but execution should adapt to context-specific constraints.
