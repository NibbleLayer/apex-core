---
name: "edd-workflow"
description: "Work-centric cyclical EDD workflow where ExecutionEnvelope governs iterative execution, evidence, findings, decisions, and next execution."
triggers:
  - "/edd"
  - "execution-driven development"
  - "start work"
  - "edd workflow"
  - "new feature"
version: "3.2.0"
metadata:
  scope: [root]
  auto_invoke: "Starting an EDD execution workflow"
---

# EDD Work Workflow

## Purpose
Drive work through iterative execution loops. Work is the operational anchor. ExecutionEnvelope is the governed execution unit. Execution produces evidence. Evidence produces findings. Findings drive decisions. Decisions govern next execution.

## Core Model
1. Start from repository context and active work state.
2. Anchor all action to one `Work` item.
3. Define or refresh one `ExecutionEnvelope` for the next execution slice.
4. Execute.
5. Capture evidence.
6. Derive findings or conclusions.
7. Record decisions.
8. Select the next execution slice or settle when the work objective is actually satisfied.
9. Repeat the loop until no meaningful execution remains.

## Operational Anchor
- `Work`: objective, scope boundary, affected surfaces, acceptance checks, active state.
- `ExecutionEnvelope`: goal of current slice, risk tier, verification path, rollback path, delegation plan, expected evidence.
- `DecisionRecord`: add only when the loop produces a consequential trade-off or durable rationale.
- `Full Design`: escalation artifact only when risk or ambiguity justifies deeper contract depth.

## ExecutionEnvelope Operations

The ExecutionEnvelope system is **operational**. Use these CLI commands to manage envelopes:

```bash
# Create envelope within a work
aiwf work envelope create <work_id> --objective "..."

# Start execution
aiwf work envelope start <envelope_id>

# Record findings from evidence analysis
aiwf work envelope findings <envelope_id> --finding "..." --severity info|warning|blocking

# Complete successfully
aiwf work envelope complete <envelope_id>

# Or fail/skip
aiwf work envelope fail <envelope_id> --reason "..."
aiwf work envelope skip <envelope_id> --reason "..."

# Inspect
aiwf work envelope list <work_id>
aiwf work envelope show <envelope_id>
aiwf work envelope active <work_id>
```

Envelope lifecycle: `pending → executing → completed|failed|skipped`. Failed/skipped envelopes can retry back to `pending`.

Findings are first-class records attached to envelopes alongside evidence and decisions:
- **info**: observational findings, non-blocking notes
- **warning**: concerns that should be addressed but do not block progress
- **blocking**: issues that must be resolved before the envelope can complete

## Contract Depth Policy
- Default: `Work + ExecutionEnvelope` — this is now a **concrete operational artifact pair**, not conceptual
- Add `DecisionRecord` when findings force a consequential decision
- Require `Full Design` only for `T2-high`, migration, major API redesign, irreversible data impact, or unresolved cross-system complexity
- Treat contract depth as escalation pressure, not default ceremony
- Use `findings` to capture evidence-derived conclusions as a first-class concept alongside evidence blobs and decision records

## Loop Surfaces

### Frame Or Refresh Work
Entry surfaces:
- `aiwf new <description>`
- `aiwf work create ...`

Actions:
1. Invoke @skill/brainstorm.
2. Read repository state and relevant governed artifacts.
3. Produce or refresh `Work + ExecutionEnvelope`.
4. Stop only for governance hard-block ambiguity.

Gate:
- Block only on unresolved security, data, API/contract, or migration ambiguity.

### Select Next Execution
Entry surfaces:
- `aiwf plan [work-id]`
- `aiwf work decide ...`
- `aiwf work next`

Actions:
1. Choose the next execution slice from current work state, evidence, and decisions.
2. Refresh verification and rollback expectations for the slice.
3. Delegate non-trivial implementation to specialized agents.
4. Keep selection aligned to the active work model; do not invent separate spec states.
5. Check `aiwf work envelope active <work_id>` for in-progress envelopes before creating new ones.

ExecutionEnvelope minimum:
- slice objective
- touched files or surfaces
- verification command or evidence path
- rollback or recovery note when mutation risk exists
- expected evidence output

### Execute And Capture Evidence
Entry surfaces:
- `aiwf step [N] [--status ...]`
- `aiwf work evidence ...`
- `aiwf work transition ...`

Envelope surfaces:
```bash
# Start the envelope before execution
aiwf work envelope start <envelope_id>

# Record findings as you go
aiwf work envelope findings <envelope_id> --finding "..." --severity info|warning|blocking
```

Execution rules:
1. Mark progress in the work model.
2. Use TDD when behavior can be specified by tests before implementation.
3. For docs/config/metadata-only work, use the narrowest valid verification instead of forcing synthetic tests.
4. Capture evidence as execution progresses.
5. Record findings derived from evidence into the active envelope.
6. Re-check work status when findings change the next slice.

TDD policy:
- Apply RED → GREEN → REFACTOR when code behavior is testable and the test can be written first.
- Do not force TDD for pure documentation, generated-doc sync, or metadata-only edits.

Gate:
- Do not mark an execution slice complete without verification evidence appropriate to the risk tier.

### Derive Findings And Decide Next Execution
Entry surfaces:
- `aiwf work evidence ...`
- `aiwf work decide ...`
- `aiwf work next`
- `aiwf work envelope findings <envelope_id> --finding "..." --severity info|warning|blocking`

Actions:
1. Convert captured evidence into findings or conclusions.
2. Record decisions when findings change approach, scope, risk handling, or architecture.
3. Choose the next execution slice.
4. Loop back through execution until the work objective is satisfied.

Gate:
- Do not continue blindly when evidence contradicts the current approach.
- Do not complete an envelope with unresolved blocking findings.

### Settle When Loop Exhausts
Entry surfaces:
- `aiwf done [work-id]`
- `aiwf work settle ...`

Envelope completion:
```bash
# Complete the active envelope before settling
aiwf work envelope complete <envelope_id>

# Or handle remaining envelopes
aiwf work envelope list <work_id>
```

Actions:
1. Complete or skip any remaining envelopes.
2. Run final validation for affected scope.
3. Ensure evidence, findings, and decisions are attached to the work item.
4. Settle only when no further execution slice is required for the declared objective.
5. Settle the work item through the actual CLI lifecycle.

Gate:
- Work must not be settled while required verification is missing or hard-block ambiguity remains unresolved.

## Loop Gates
- Gate 1: hard-block ambiguity resolved
- Gate 2: contract depth sufficient for current risk
- Gate 3: execution evidence recorded
- Gate 4: findings reviewed before selecting next execution
- Gate 5: final validation complete before settle

## CLI Alignment
Top-level wrappers are guided entry points over the same work loop:

```bash
aiwf new|check|plan|step|done
```

Explicit lifecycle operations remain available for precise automation inside the loop:

```bash
aiwf work create|show|transition|evidence|decide|next|settle|evolve|abandon
```

Envelope-specific operations:

```bash
aiwf work envelope create|start|findings|complete|fail|skip|list|show|active
```

## Constraints
- ALWAYS treat work as operational anchor.
- ALWAYS treat `ExecutionEnvelope` as the governed execution unit.
- ALWAYS run the loop `execution -> evidence -> findings/conclusions -> decisions -> next execution`.
- ALWAYS treat specification depth as adaptive escalation, not mandatory.
- ALWAYS use the smallest sufficient contract.
- ALWAYS delegate non-trivial implementation work.
- ALWAYS use TDD where applicable.
- ALWAYS record findings as first-class artifacts alongside evidence and decisions.
- NEVER treat EDD as a one-pass linear phase ritual.
- NEVER run a separate approval-heavy spec track when intent is already clear.
- NEVER require a full design document for all non-trivial work.
- NEVER treat labs or execution backends as the identity of the workflow.
- NEVER invent lifecycle states or artifacts not emitted by the current CLI/work model.
- NEVER bypass governance hard-block ambiguity.
- NEVER complete an envelope while blocking findings remain unresolved.
