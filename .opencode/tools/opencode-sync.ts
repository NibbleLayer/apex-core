import { tool } from "@opencode-ai/plugin";

/**
 * Deploys OpenCode executable flows (agents and tools) to the local or global environment.
 * Wraps ./platforms/opencode/scripts/sync.sh
 */
export default tool({
  description: "Deploys OpenCode executable flows (agents and tools) to the local (.opencode) or global environment.",
  args: {
    global: tool.schema.boolean().optional().describe("If true, synchronizes globally (~/.config/opencode)."),
    target: tool.schema.string().optional().describe("Specific target path (optional)."),
  },
  async execute(args) {
    const { global, target } = args;
    
    const cmd = ["./platforms/opencode/scripts/sync.sh"];
    
    if (global) {
      cmd.push("--global");
    }
    
    if (target) {
      cmd.push("--target", target);
    }

    const proc = Bun.spawn(cmd, {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const output = (stdout + stderr).trim();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(output || `opencode-sync failed with exit code ${exitCode}`);
    }

    return output;
  },
});
