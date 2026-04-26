---
scope: "/"
type: "rules"
role: "Project Root"
priority: critical
metadata:
  system: "aiwf"
  execution_context: "repository"
  transfer_class: "transferable_parametric"
  doc_audience: "agent"
  lifecycle: "bootstrap"
  runtime_model: "brokered"
  supported_bootstrap_runtimes: ["opencode", "generic", "manual"]
  supported_platforms: ["opencode"]
---

# Rules: apex-core

## Context & Responsibility
This file defines the **global rules and context** for the project. It acts as the central authority for architectural standards.

**AIWF Runtime Context:** This project currently targets the OpenCode runtime. `AGENTS.md` files remain the canonical governance context.

## Operational Contract (Router)

This repository is governed by the **Operational Contract** which defines Risk Tiers, Exception Policies, and Definition Gates.

> **CRITICAL REFERENCE**: For detailed compliance rules (Risk Tiers, Gates, Exceptions), you MUST consult:
> [`governance/index/OPERATIONAL_CONTRACT.md`](/governance/index/OPERATIONAL_CONTRACT.md)

### Runtime Strategy
- **Runtime Scope**: AIWF bootstrap/runtime behavior is maintained for OpenCode self-hosting.
- **Source of Truth**: `AGENTS.md`, `skills/`, and `platforms/opencode/`.
- **Execution Flow**: Update Source -> Sync (`skill-sync`, `rules-sync`) -> Validate -> Materialize.
- **Platform Coverage**: The maintained product surface is OpenCode-only until additional runtimes are implemented and verified.

### Delegation Ambiguity Protocol
- **Delegation Discipline**: For non-trivial tasks (multi-step implementation, code changes, testing, migration, or CI-impacting work), the System Architect MUST delegate execution to specialized sub-agents.
- **Ambiguity Guardrail**: When user instructions mention "sub-agent(s)" with ambiguous modifiers (`no`, `forget`, `for now`, `later`, `skip`), the orchestrator MUST disambiguate two axes:
  - `creation`: creating/modifying sub-agents.
  - `execution`: invoking existing sub-agents.
- **Safe Default**: If ambiguity remains, default to blocking `creation` only, while keeping `execution` delegation enabled.
- **Hard Stop Condition**: The orchestrator MUST NOT bypass delegation for non-trivial tasks unless the user explicitly requests no delegation for execution.

## Operational Standards (Summary)
- **Language Protocol**: English ONLY for technical output, code, docs, and comments.
- **Git Excellence**: Conventional Commits, Atomic Commits. See [`git-excellence`](/skills/git-excellence/SKILL.md).
- **Merge Discipline**: Prefer standard Merge commits. Squash/Rebase allowed only with justification.
- **Documentation Sync**: Run sync pipelines after modifying rules.
- **GitHub Operations Policy**: Use `gh` CLI as the default tool for all GitHub write operations. See [`governance/index/OPERATIONAL_CONTRACT.md`](/governance/index/OPERATIONAL_CONTRACT.md) for full policy.
- **Repository Integrity**: NEVER create, fork, or recreate repositories unless explicitly instructed by the user. Operate exclusively within the current repository.

## Data Governance & Contracts
- **Configuration Contract**: This repo adheres to `repo_intent` defined in `.aiwf/config.json`.
- **Transfer Contract**: Boundaries are governed by [`setup/transfer_contract.json`](/setup/transfer_contract.json).
- **Audit Trace**: Sensitive actions are logged to `.aiwf/audit/` and MUST NOT be transferred out.

## Capability Graph
- @skill/rules-creator
- @skill/skill-creator
- @skill/opencode-agent-creator
- @skill/rules-sync
- @skill/skill-sync
- @skill/system-sync
- @skill/git-excellence

### Auto-invoke Skills

| Action | Skill |
|--------|-------|
| After creating/modifying a skill | [`skill-sync`](/skills/skill-sync/SKILL.md) |
| Before creating a commit | [`git-excellence`](/skills/git-excellence/SKILL.md) |
| Creating new OpenCode sub-agents | [`opencode-agent-creator`](/skills/opencode-agent-creator/SKILL.md) |
| Creating or scaffolding new skills | [`skill-creator`](/skills/skill-creator/SKILL.md) |
| Defining new rules or scaffolding AGENTS.md | [`rules-creator`](/skills/rules-creator/SKILL.md) |
| Modifying AGENTS.md structure | [`rules-sync`](/skills/rules-sync/SKILL.md) |
| Synchronize all systems | [`system-sync`](/skills/system-sync/SKILL.md) |

## Specialized Sub-agents (OpenCode Flows)

Delegate tasks to these agents when the request matches their specific domain:

| Domain / Trigger | Agent |
|------------------|-------|
| **System Architect**: Primary orchestrator. Handles strategic planning. | [`system-architect`](/.opencode/agents/system-architect.md) |
| **Documentation**: Verifying facts, checking official docs/APIs. | [`doc-retriever`](/.opencode/agents/doc-retriever.md) |
| **Obsidian & Knowledge**: Obsidian-optimized documentation. | [`obsidian-knowledge-architect`](/.opencode/agents/obsidian-knowledge-architect.md) |
| **DevOps & Scripting**: Automation, log parsing. | [`devops-scripter`](/.opencode/agents/devops-scripter.md) |
| **UI/App Architecture**: GUI, Electron, Mobile. | [`interactive-app-architect`](/.opencode/agents/interactive-app-architect.md) |
| **Git Operations**: Local status, diffs, staging. | [`git-specialist`](/.opencode/agents/git-specialist.md) |
| **Tooling & Infrastructure**: Auditing tooling and sync scripts. | [`tooling-specialist`](/.opencode/agents/tooling-specialist.md) |
| **Systems Engineering**: Low-level (Rust/C++/Go). | [`native-systems-engineer`](/.opencode/agents/native-systems-engineer.md) |
| **LLM Context & Rules**: Creating/optimizing documentation for LLMs. | [`llm-context-engineer`](/.opencode/agents/llm-context-engineer.md) |

## Platform Native Agents

| Agent | Purpose |
|-------|---------|
| `web-researcher` | External web access. |
| `explore` | Fast codebase exploration. |
| `general` | General-purpose agent. |

## Delegation & Boundaries

### Nested Rules

| Rule Scope | Location |
| :--- | :--- |
| `governance/contract` | [governance/index/OPERATIONAL_CONTRACT.md](/governance/index/OPERATIONAL_CONTRACT.md) |
| `/skills/` | [skills/AGENTS.md](/skills/AGENTS.md) |
| `.aiwf-linter` | [.aiwf-linter/AGENTS.md](/.aiwf-linter/AGENTS.md) |
| `setup` | [setup/AGENTS.md](/setup/AGENTS.md) |

---
*Bootstrap Context:*
- Generated through AIWF bootstrap runtime adapter flow.
- Generated at: `2026-04-24T02:07:30.520083+00:00`.
- Primary objective: Deliver reliable software with explicit operational governance.
- Initial risk tier: `T1-medium`
