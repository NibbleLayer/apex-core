---
scope: "/"
type: "rules"
role: "Project Root"
priority: critical
---

# Rules: apex-core

## Repository Identity
- Repository name: `apex-core`
- Public package: `@nibblelayer/apex-control-plane-core`
- Internal support package: `@nibblelayer/apex-persistence`
- Deferred private peer: `apex-managed`

## Handoff Context
This repository is the active public `apex-core` workspace and its operational context must remain self-contained.

- Keep repository-facing naming aligned with the ontology above.
- Do not represent deferred `apex-managed` work as part of this repository.
- Keep required `.aiwf`, `.aiwf-governance`, and `.opencode` artifacts locally coherent so routine work does not depend on external repository lookups.
- Historical lineage is preserved in local provenance artifacts, but routine operation must remain self-contained within this repo.

## Operational Expectations
- Keep changes minimal, production-grade, and scoped to the extracted public workspace.
- Prefer Node 22 for local verification.
- Preserve package and workspace coherence before expanding functionality.

### Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
|--------|-------|
| After creating/modifying a skill | [`skill-sync`](/skills/skill-sync/SKILL.md) |
| Before creating a commit | [`git-excellence`](/skills/git-excellence/SKILL.md) |
| Before creating a commit or PR | [`git-excellence`](/skills/git-excellence/SKILL.md) |
| Creating new OpenCode sub-agents | [`opencode-agent-creator`](/skills/opencode-agent-creator/SKILL.md) |
| Creating or scaffolding new skills | [`skill-creator`](/skills/skill-creator/SKILL.md) |
| Defining new rules or scaffolding AGENTS.md | [`rules-creator`](/skills/rules-creator/SKILL.md) |
| During Pull Request creation | [`git-excellence`](/skills/git-excellence/SKILL.md) |
| Modifying AGENTS.md structure or adding new rules | [`rules-sync`](/skills/rules-sync/SKILL.md) |
| Regenerate AGENTS.md Auto-invoke tables (sync.sh) | [`skill-sync`](/skills/skill-sync/SKILL.md) |
| Running AIWF init or refining bootstrap intake behavior | [`bootstrap`](/skills/bootstrap/SKILL.md) |
| Starting a new feature or change that requires design thinking | [`brainstorm`](/skills/brainstorm/SKILL.md) |
| Starting a spec-driven development workflow | [`spec-workflow`](/skills/spec-workflow/SKILL.md) |
| Synchronize all systems (OpenCode runtime, AGENTS.md, skill/rule metadata) | [`system-sync`](/skills/system-sync/SKILL.md) |
| Troubleshoot why a skill is missing from AGENTS.md auto-invoke | [`skill-sync`](/skills/skill-sync/SKILL.md) |
| User describes intent to build something without a clear spec | [`brainstorm`](/skills/brainstorm/SKILL.md) |
| When an agent needs to operate the AIWF CLI or machine API | [`aiwf-cli-operator`](/skills/aiwf-cli-operator/SKILL.md) |
| When detecting staged changes | [`git-excellence`](/skills/git-excellence/SKILL.md) |
