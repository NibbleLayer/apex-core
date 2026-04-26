---
name: "brainstorm"
description: "EDD-first intake that reads repo context, recommends the first execution loop, and escalates contract depth only when risk or ambiguity warrants it."
triggers:
  - "brainstorm"
  - "I want to build"
  - "I need a feature"
  - "let's design"
  - "help me think through"
version: "2.1.0"
metadata:
  scope: [root]
  auto_invoke:
    - "Starting a new feature or change that requires design thinking"
    - "User describes intent to build something without a clear execution path"
  priority: high
---

# brainstorm

## Purpose
Convert vague intent into the first execution-ready loop with the smallest sufficient artifact set.

## Default Behavior
1. Read repository context first.
2. Infer likely intent, constraints, touched surfaces, and risk tier.
3. Respond once with:
   - recommended execution start
   - assumptions
   - scope boundaries
   - contract depth selected
   - first execution slice
4. Proceed when intent is clear and no governance hard-block exists.

## Contract Ladder
Select the minimum contract that preserves clarity and safety.

### Level 1: Work + ExecutionEnvelope
Use by default for mutating work when intent is clear.

Required content:
- `Work`: objective, in-scope, out-of-scope, affected surfaces, acceptance checks
- `ExecutionEnvelope`: risk tier, verification approach, rollback path, delegation plan

### Level 2: DecisionRecord
Add when one or more conditions hold:
- meaningful trade-off between approaches
- non-obvious architecture choice
- user asked for recommendation among options
- likely future need to explain why a path was chosen

Required content:
- options considered
- decision
- rationale
- rejected alternatives
- follow-up implications

### Level 3: Full Design
Use only when risk or ambiguity warrants a full design artifact.

Required triggers:
- `T2-high` risk
- cross-system migration
- material API/contract redesign
- irreversible data impact
- governance requires deeper review

Artifact path when needed:
- `.aiwf-governance/work/<work-id>/design.md`

## Hard-Block Ambiguity Rules
Ask questions only when repository reading cannot resolve a material ambiguity in:
- security boundary or threat surface
- data model, persistence, retention, or migration impact
- external/internal API contract semantics
- irreversible migration, rollout, or rollback behavior

When blocked:
1. Ask the smallest set of questions needed to unblock.
2. Batch related questions in one message when safe.
3. State why execution cannot continue without answers.

## Workflow

### Step 1: Read Before Asking
Read relevant code, docs, governed artifacts, and active workflow context.

### Step 2: Classify
Determine:
- request intent
- likely risk tier
- required contract depth
- whether delegation is needed
- whether TDD is applicable later

### Step 3: Emit Recommended Contract
Produce one response containing:
- problem framing
- recommended approach
- assumptions
- in/out scope
- contract artifact(s) to use
- first execution slice
- evidence direction
- hard-block questions only if needed

### Step 4: Hand Off Cleanly
- If clear and low/medium risk: proceed into the EDD execution loop.
- If blocked: wait only on the explicit hard-block items.
- If full design is required: create the design artifact, then continue with the deeper workflow.

## Output Shapes

### Default Output Shape
```md
## Recommended Start
- Objective: ...
- Approach: ...
- Assumptions: ...
- In scope: ...
- Out of scope: ...
- Contract depth: Work + ExecutionEnvelope
- First execution slice: ...
- Evidence to capture: ...
- Verification: ...
- Next execution trigger: ...
```

### DecisionRecord Add-On
```md
## DecisionRecord
- Options: ...
- Decision: ...
- Rationale: ...
- Rejected alternatives: ...
- Implications: ...
```

### Full Design Triggered Output
```md
## Full Design Required
- Trigger: ...
- Risk tier: ...
- Required artifact: .aiwf-governance/work/<work-id>/design.md
- Blocking questions: ...
```

## Constraints
- ALWAYS read repository context before questioning the user.
- ALWAYS prefer a one-message recommendation over serial approval chatter.
- ALWAYS use `Work + ExecutionEnvelope` as the default contract for mutating work.
- ALWAYS optimize for immediate execution, evidence capture, and next-loop clarity.
- ALWAYS escalate to `DecisionRecord` or `Full Design` only when justified by risk, ambiguity, or decision complexity.
- NEVER force one-question-per-turn behavior.
- NEVER require section-by-section approvals.
- NEVER frame the intake as a mandatory separate planning ceremony.
- NEVER require a full design document for every non-trivial change.
- NEVER ask questions that repository inspection can answer.
- NEVER proceed through governance hard-block ambiguity.

## Related Capabilities
- @skill/edd-workflow
- @skill/aiwf-cli-operator
