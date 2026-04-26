---
name: system-sync
description: Synchronizes skills, rules, and OpenCode runtime artifacts.
triggers:
  - "sync all systems"
  - "update instructions"
  - "regenerate ai documentation"
version: "1.0.0"
metadata:
  scope: [root]
  auto_invoke: "Synchronize all systems (OpenCode runtime, AGENTS.md, skill/rule metadata)"
---

# System Sync

## Context
This skill is the master orchestrator for project-wide synchronization. It ensures that source changes are propagated to the maintained OpenCode runtime and metadata outputs.

## Operational Contract Alignment
- Source updates must start from versioned definitions (`AGENTS.md`, `skills/`, `platforms/opencode/`).
- Generated runtime folders are local artifacts.
- OpenCode is the canonical execution layer.

## Adaptive Execution
- Use a unified sync standard, but execute only the pipelines required by the current scope and risk.
- Avoid unnecessary materialization when only source synchronization is needed.

## Guidelines
- **Run after changes**: Always run this skill after modifying the architectural core of the project.
- **Unified Entry Point**: It invokes the canonical `aiwf` sync/compile surfaces while preserving compatibility shims for older automation.

## Usage
### OpenCode Environment
```javascript
system_sync({ all: true })
```

### Manual
```bash
aiwf sync all
```

## Constraints
- **ALWAYS** verify that `AGENTS.md` is present before syncing.
- **NEVER** overwrite user-defined project logic; only sync framework-managed sections.
