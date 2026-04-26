import type { Plugin } from "@opencode-ai/plugin"

/**
 * AIWF Guard Plugin — Enforces repository integrity by blocking MCP tools
 * that would create, fork, or delete GitHub repositories.
 *
 * This plugin hooks into tool.execute.before to intercept and block
 * dangerous GitHub operations before they reach the MCP server.
 *
 * Policy source: governance/index/OPERATIONAL_CONTRACT.md#GitHub Operations Policy
 */

const BLOCKED_TOOLS: Record<string, string> = {
  "github-local_create_repository":
    "Blocked by AIWF governance: Repository creation is prohibited. Operate exclusively within the current repository. See governance/index/OPERATIONAL_CONTRACT.md for the full policy.",
  "github-local_fork_repository":
    "Blocked by AIWF governance: Repository forking is prohibited. Operate exclusively within the current repository. See governance/index/OPERATIONAL_CONTRACT.md for the full policy.",
  "github-local_delete_file":
    "Blocked by AIWF governance: Remote file deletion is restricted. Use local git operations and push through normal workflow. See governance/index/OPERATIONAL_CONTRACT.md for the full policy.",
}

export const AiwfGuardPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input) => {
      const reason = BLOCKED_TOOLS[input.tool]
      if (reason) {
        throw new Error(reason)
      }
    },
  }
}
