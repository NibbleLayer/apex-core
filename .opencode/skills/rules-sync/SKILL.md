---
name: "rules-sync"
description: "Syncs rule metadata (scope, parent) to automatically build the rules hierarchy in AGENTS.md files."
triggers:
  - "/sync-rules"
  - "sync rule hierarchy"
version: "1.0.0"
metadata:
  scope: [root]
  auto_invoke: "Modifying AGENTS.md structure or adding new rules"
---

# Rules Sync

## Context
This skill ensures that the distributed network of `AGENTS.md` files (which define the Rules) remains consistent and navigable. It reads the frontmatter metadata (`scope`, `type`, `parent`) from every `AGENTS.md` file in the repository and updates the "Delegation" or "Sub-Rules" sections of the *parent* rules to explicitly list their children.

## Operational Contract Alignment
- `AGENTS.md` hierarchy is the canonical operational contract and must remain self-contained.
- Sync behavior must remain independent of model vendor runtime folders.
- Preserve clear separation between versioned governance and local generated artifacts.

## Adaptive Execution
- Use full hierarchy refresh when structural changes occur.
- Use dry-run and targeted checks when validating risky or partial edits.

## Guidelines
- **Run Automatically**: This should be run after creating or moving a ruleset.
- **Source of Truth**: The YAML frontmatter in each `AGENTS.md` file is the source of truth. The Markdown content is updated to reflect it.
- **Hierarchy**: It builds a graph where:
  - Root knows about direct children (Nested Rules).
  - Nested Rules know about their children (if any).

## Usage

### OpenCode Environment (Native)

When running within OpenCode, prefer using the native tool:

```javascript
// Trigger the tool directly
rules_sync()
```

### Manual / Other Platforms

Run the sync script:
```bash
./skills/rules-sync/assets/sync.sh

# Include runtime .opencode scopes explicitly (diagnostics only)
./skills/rules-sync/assets/sync.sh --include-runtime
```

## Constraints
- **NEVER** overwrite manual descriptions in the `AGENTS.md`. Only update the auto-generated hierarchy sections.
- **ALWAYS** look for the `AGENTS.md` files recursively.

## Related
- @skill/rules-creator (Defines the rules that this skill syncs)
- @skill/skill-sync (Syncs skills metadata, whereas this syncs rule hierarchy)
