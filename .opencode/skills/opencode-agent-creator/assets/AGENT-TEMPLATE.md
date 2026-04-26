---
description: >-
  {{DESCRIPTION}}

  <example>
  Context: {{EXAMPLE_CONTEXT}}
  user: "{{EXAMPLE_USER_PROMPT}}"
  assistant: "I will use the {{AGENT_NAME}} to {{ACTION}}."
  <commentary>
  {{EXAMPLE_COMMENTARY}}
  </commentary>
  </example>
mode: subagent
tools:
  glob: true
  webfetch: false
  todowrite: false
---
You are the {{AGENT_TITLE}}. {{ROLE_DESCRIPTION}}

### CRITICAL BOUNDARIES
- **Constraint 1**: {{CONSTRAINT_1}}
- **Constraint 2**: {{CONSTRAINT_2}}

### OPERATIONAL WORKFLOW
1. **Phase 1**: {{PHASE_1}}
2. **Phase 2**: {{PHASE_2}}
