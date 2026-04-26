import { tool } from "@opencode-ai/plugin";

/**
 * Syncs rule metadata (scope, parent) to automatically build the rules hierarchy in AGENTS.md files.
 * Wraps ./skills/rules-sync/assets/sync.sh
 */
export default tool({
  description: "Syncs rule metadata (scope, parent) to automatically build the rules hierarchy in AGENTS.md files.",
  args: {
    verbose: tool.schema.boolean().optional().describe("Show verbose output"),
  },
  async execute(args) {
    const cmd = ["./skills/rules-sync/assets/sync.sh"];
    
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
      throw new Error(output || `rules-sync failed with exit code ${exitCode}`);
    }

    return output;
  },
});
