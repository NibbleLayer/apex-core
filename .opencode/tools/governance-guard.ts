import { tool } from "@opencode-ai/plugin"

/**
 * AIWF Governance Guard Tool — Pre-flight policy checker for GitHub/Git operations.
 *
 * Agents call this tool BEFORE performing GitHub write operations to verify
 * compliance with AIWF governance policy. Returns structured policy information.
 *
 * This is a READ-ONLY tool: it never blocks execution, only informs.
 * The actual blocking is handled by the AiwfGuardPlugin (aiwf-guard.ts).
 *
 * Policy source: governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy
 */

interface PolicyEntry {
  allowed: boolean
  reason: string
  tool?: string
  ref: string
}

const POLICIES: Record<string, PolicyEntry> = {
  repo_create: {
    allowed: false,
    reason: "Repository creation is prohibited by AIWF governance policy.",
    tool: "gh repo create (requires explicit user confirmation)",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  repo_fork: {
    allowed: false,
    reason: "Repository forking is prohibited by AIWF governance policy.",
    tool: "gh repo fork (requires explicit user confirmation)",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  repo_delete: {
    allowed: false,
    reason: "Repository deletion is classified as T2-high risk and requires explicit user confirmation with a recorded justification.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  pr_create: {
    allowed: true,
    tool: "gh pr create",
    reason: "Use gh CLI as the canonical tool for PR creation.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  issue: {
    allowed: true,
    tool: "gh issue",
    reason: "Use gh CLI as the canonical tool for issue management.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  release: {
    allowed: true,
    tool: "gh release",
    reason: "Use gh CLI as the canonical tool for release management.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  label: {
    allowed: true,
    tool: "gh label",
    reason: "Use gh CLI as the canonical tool for label management.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  comment: {
    allowed: true,
    tool: "gh pr comment or gh issue comment",
    reason: "Use gh CLI as the canonical tool for comments.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  commit: {
    allowed: true,
    tool: "git commit",
    reason: "Follow git-excellence skill: Conventional Commits, atomic commits, narrative body.",
    ref: "skills/git-excellence/SKILL.md",
  },
  branch_create: {
    allowed: true,
    tool: "git checkout -b or gh repo fork (requires confirmation)",
    reason: "Branch creation is allowed. Follow branching conventions.",
    ref: "skills/git-excellence/SKILL.md",
  },
  branch_delete: {
    allowed: true,
    tool: "git branch -d or git push origin --delete",
    reason: "Branch deletion on protected branches is classified as T2-high risk.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
  github_write: {
    allowed: true,
    tool: "gh (GitHub CLI)",
    reason: "Use gh CLI as the default tool for all GitHub write operations. API-based tools are fallback only when gh does not support the operation.",
    ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
  },
}

export default tool({
  description:
    "Check if a GitHub or Git operation is permitted by AIWF governance policy. " +
    "Call this BEFORE performing GitHub write operations to verify compliance. " +
    "Returns structured policy information including allowed status, recommended tool, and policy reference.",
  args: {
    operation: tool.schema
      .string()
      .describe(
        "Operation to check: repo_create, repo_fork, repo_delete, pr_create, issue, release, label, comment, commit, branch_create, branch_delete, github_write"
      ),
  },
  async execute(args) {
    const policy = POLICIES[args.operation]

    if (policy) {
      return JSON.stringify(
        {
          operation: args.operation,
          ...policy,
        },
        null,
        2
      )
    }

    return JSON.stringify(
      {
        operation: args.operation,
        allowed: true,
        reason:
          "No specific policy restriction found for this operation. Default: use gh CLI for GitHub operations.",
        tool: "gh (GitHub CLI)",
        ref: "governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy",
      },
      null,
      2
    )
  },
})
