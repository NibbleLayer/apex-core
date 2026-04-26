# Agent Reference Examples

## 1. Minimalist Nested Agent
```markdown
# AGENTS.md - Nested Context
Current Scope: /modules/core/
Core business logic and utilities.

## Capabilities & Skills
- @skill/code-style-validator
- @skill/unit-test-generator

## Inheritance & Delegation
- Parent: @agent/root
```

## 2. Specialized Technical Agent
```markdown
# AGENTS.md - Nested Context
Current Scope: /scripts/
Automation and CI/CD scripts.

## Capabilities & Skills
- @skill/bash-optimizer
- @skill/security-audit

## Inheritance & Delegation
- Parent: @agent/root
- Delegation: If script fails, refer to @skill/error-recovery
```

## 3. Delegation Logic
Use `@agent/[name]` to refer to other agents in the same repository:
- `Delegation: Requests for database schema changes must be routed to @agent/database`
- `Context: This agent follows the API contracts defined in @agent/backend-api`
