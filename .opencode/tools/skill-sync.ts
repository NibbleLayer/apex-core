import { tool } from "@opencode-ai/plugin";

/**
 * Synchronizes and compiles skills/rules to platform-specific configurations.
 * Wraps ./skills/setup.sh
 */
export default tool({
  description: "Synchronizes and compiles skills/rules to platform-specific configurations (.claude, .cursor, etc).",
  args: {
    all: tool.schema.boolean().optional().describe("If true, compiles for ALL supported platforms."),
  },
  async execute(args) {
    const { all } = args;
    
    const cmd = ["./skills/setup.sh"];
    if (all) {
      cmd.push("--all");
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
      throw new Error(output || `skill-sync failed with exit code ${exitCode}`);
    }

    return output;
  },
});
