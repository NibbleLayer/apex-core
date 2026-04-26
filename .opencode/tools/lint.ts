import { tool } from "@opencode-ai/plugin";

/**
 * Executes the architectural linter on the project.
 * Validates AGENTS.md and SKILL.md files against the schema.
 */
export default tool({
  description: "Executes the architectural linter to validate AGENTS.md and SKILL.md files.",
  args: {
    path: tool.schema.string().optional().describe("Root path to scan (default: current directory)."),
    fix: tool.schema.boolean().optional().describe("If true, attempts to automatically fix errors."),
  },
  async execute(args) {
    const { path: scanPath, fix } = args;
    
    const scriptArgs = ["run", "lint", "--"];
    
    if (scanPath) {
      // Ensure path is absolute if possible, or pass it as is. 
      // The linter resolves it relative to cwd if relative.
      scriptArgs.push("--dir", scanPath);
    } else {
      // Default to scanning the current working directory of the project
      scriptArgs.push("--dir", process.cwd());
    }

    if (fix) {
      scriptArgs.push("--fix");
    }

    const proc = Bun.spawn(["bun", ...scriptArgs], {
      cwd: `${process.cwd()}/.aiwf-linter`,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const output = stdout + stderr;

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(output.trim() || `Linter command failed with exit code ${exitCode}`);
    }

    return output.trim();
  },
});
