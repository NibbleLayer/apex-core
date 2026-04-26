import { tool } from "@opencode-ai/plugin";

/**
 * This is an example tool for the platforms/opencode system.
 * Allows the agent to read the latest git commit in a structured way.
 */
export default tool({
  description: "Gets summary information about the current git state (branch, latest commit).",
  args: {
    verbose: tool.schema.boolean().optional().describe("If true, shows more details of the log."),
  },
  async execute(args) {
    const { verbose } = args;
    // We use process.cwd() to ensure we run in the project root
    const cmd = verbose 
      ? "git log -1 --stat"
      : "git log -1 --format='%h - %an: %s'";
    
    const proc = Bun.spawn(cmd.split(" "), { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error((stderr || stdout).trim() || `git-status failed with exit code ${exitCode}`);
    }
    return stdout.trim();
  },
});
