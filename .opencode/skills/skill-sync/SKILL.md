---
name: skill-sync
description: >
  Syncs skill metadata to AGENTS.md Auto-invoke sections.
  Trigger: When updating skill metadata (metadata.scope/metadata.auto_invoke), regenerating Auto-invoke tables, or running ./skills/skill-sync/assets/sync.sh (including --dry-run/--scope).
license: Apache-2.0
metadata:
  author: ai-workflows
  version: "1.0"
  scope: [root]
  auto_invoke:
    - "After creating/modifying a skill"
    - "Regenerate AGENTS.md Auto-invoke tables (sync.sh)"
    - "Troubleshoot why a skill is missing from AGENTS.md auto-invoke"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

## Purpose

Keeps AGENTS.md Auto-invoke sections in sync with skill metadata. When you create or modify a skill, run the sync script to automatically update all affected AGENTS.md files.

## Operational Contract Alignment
- This sync operates on versioned source definitions, not on provider-specific runtime folders.
- The canonical contract remains in `AGENTS.md`; generated runtime instructions are downstream artifacts.
- Maintain provider-agnostic behavior in generated Auto-invoke tables.

## Adaptive Execution
- Run full sync for broad changes, or scope-targeted sync (`--scope`) for constrained updates.
- Prefer the smallest safe sync radius that preserves consistency.

## Required Skill Metadata

Each skill that should appear in Auto-invoke sections needs these fields in `metadata`.

`auto_invoke` can be either a single string **or** a list of actions:

```yaml
metadata:
  author: ai-workflows
  version: "1.0"
  scope: [backend/api]                                    # Directory path where AGENTS.md lives (or 'root')

  # Option A: single action
  auto_invoke: "Creating/modifying endpoints"

  # Option B: multiple actions
  # auto_invoke:
  #   - "Creating/modifying endpoints"
  #   - "Refactoring API logic"
```

### Scope Values

The scope corresponds to the directory path relative to the repository root.

| Scope | Updates |
|-------|---------|
| `root` | `AGENTS.md` (repo root) |
| `path/to/dir` | `path/to/dir/AGENTS.md` |

Skills can have multiple scopes: `scope: [root, backend/api]`

---

## Usage

### OpenCode Environment (Native)

When running within OpenCode, prefer using the native tool:

```javascript
// Trigger the tool directly
skill_sync({ all: true })
```

### Manual / Other Platforms

#### After Creating/Modifying a Skill

```bash
./skills/skill-sync/assets/sync.sh
```

### What It Does

1. **Bootstrap**: Checks if `AGENTS.md` exists at the root. If not, it automatically creates it using the standard template from `@skill/rules-creator`.
2. **Discovery**: Reads all `SKILL.md` files from both `skills/` and `.opencode/skills/`.
3. **Extraction**: Extracts `metadata.scope` and `metadata.auto_invoke`.
4. **Mapping**: Maps scope to directory path (e.g. `foo` -> `foo/AGENTS.md`).
5. **Generation**: Generates Auto-invoke tables for each AGENTS.md.
6. **Update**: Updates the `### Auto-invoke Skills` section in each file.

By default, this sync reads versioned `skills/` only. Runtime `.opencode/skills/` can be included explicitly with `--include-runtime` for diagnostics.

---

## Example

Given this skill metadata:

```yaml
# skills/example-skill/SKILL.md
metadata:
  author: ai-workflows
  version: "1.0"
  scope: [backend]
  auto_invoke: "Optimizing database queries"
```

The sync script generates in `backend/AGENTS.md`:

```markdown
### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
| Optimizing database queries | [`example-skill`](/skills/example-skill/SKILL.md) |
```

---

## Commands

```bash
# Sync all AGENTS.md files
./skills/skill-sync/assets/sync.sh

# Dry run (show what would change)
./skills/skill-sync/assets/sync.sh --dry-run

# Sync specific scope only
./skills/skill-sync/assets/sync.sh --scope backend/api

# Include runtime skill copies explicitly (diagnostics only)
./skills/skill-sync/assets/sync.sh --include-runtime
```

---

## Checklist After Modifying Skills

- [ ] Added `metadata.scope` to new/modified skill
- [ ] Added `metadata.auto_invoke` with action description
- [ ] Ran `./skills/skill-sync/assets/sync.sh`
- [ ] Verified AGENTS.md files updated correctly 
