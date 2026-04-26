---
name: "git-excellence"
description: "Establishes high-precision standards for Git operations, ensuring atomic history, semantic messages, and documented Pull Requests."
triggers:
  - "/commit"
  - "/pr"
  - "improve commit message"
  - "prepare pull request"
version: "1.0.0"
metadata:
  scope: [root]
  auto_invoke: 
    - "Before creating a commit or PR"
    - "Before creating a commit"
    - "When detecting staged changes"
    - "During Pull Request creation"
  priority: high
---

# git-excellence

## Context
The Git history is not merely a chronological log, but the technical documentation of the project's architectural decisions. This skill ensures every history entry is useful for debugging, auditing, and long-term collaboration, transforming the commit process into a precision engineering practice.

## Operational Contract Alignment
- Apply these Git standards to versioned source definitions (`AGENTS.md`, `skills/`, `platforms/opencode/`, linter, templates).
- Avoid committing local runtime artifacts (`.opencode/`) unless explicitly requested by the user.
- Keep commit/PR language provider-agnostic and architecture-centered.
- For all GitHub write operations, use the official `gh` CLI as the canonical tool per the GitHub Operations Policy in the Operational Contract.

## Adaptive Execution
- Preserve conventional and atomic quality bars, but adapt commit slicing strategy to the actual diff and risk profile.
- For similar change sets, use different commit strategies when reversibility or auditability requires it.

## Guidelines

### Conventional Commits
All history communications must follow the Conventional Commits standard:
- **Structure**: `<type>(<scope>): <short description>`
- **Allowed Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Body**: Mandatory for complex changes. It must explain the motivation behind the change ("the why") and not just what was done.
- **Footer**: To reference issues (`Closes #123`) or warn about `BREAKING CHANGE`.

### Atomicity and Analysis
Before proposing a message, `@agent/git-specialist` must be invoked to analyze the diff:
- **Single Logical Change**: If the diff contains unrelated changes (e.g., a bug fix and a refactor), the user should be suggested to perform separate commits.
- **Content Validation**: Ensure no temporary files, secrets, or unnecessary logs are included.

### Commit Process
1. **Analyze Diff**: Evaluate which files changed and their real impact.
2. **Identify Type and Scope**: Determine the change category and affected module.
3. **Write Narrative Message**: Write an imperative header and an explanatory body.
4. **Confirmation**: If the change is extensive or architectural, request user confirmation before executing `git commit`.

### Pull Request (PR) Excellence
When generating a PR description, follow this structured template:
- **Summary**: List of key changes in precise technical language.
- **Architecture**: Description of changes in data flow, business logic, or file structure.
- **Testing**: Summary of tests performed (unit, integration, manual) to validate the change.

### Merge Strategy Discipline
- Prefer standard **Merge commit** integration to preserve authored atomic commit history.
- Use **Squash** or **Rebase** only when explicitly justified (e.g., noisy or non-atomic branch history).
- Treat GitHub auto-generated merge subjects as operational noise and enforce commit-message policy on authored commits.

## Constraints
- **NEVER** use generic messages like "fix bugs", "update code", or "more changes".
- **NEVER** perform empty commits or commits without previous diff analysis.
- **ALWAYS** use the imperative present tense in the header ("add" instead of "added").
- **ALWAYS** check for secrets in the diff before suggesting the commit.
- **ALWAYS** use `gh` (GitHub CLI) for all GitHub write operations (PR creation, issue management, releases, comments, labels). Only fall back to API tools if `gh` does not support the specific operation.
- **NEVER** create, fork, or recreate GitHub repositories. Operate exclusively within the current repository unless the user provides explicit confirmed instructions to do otherwise.
- **NEVER** work against separate repositories, temporary repositories, or test repositories. All GitHub operations target the current repository context.

## Examples

### Example 1: Feature Commit
**Input**: Added schema validation in the users endpoint.
**Output**:
`feat(api): implement schema validation with Zod in /users`

`Zod library is integrated to validate request bodies for POST and PATCH requests. This prevents type errors in the database and improves error response for the client.`

`Closes #89`

### Example 2: Structured Pull Request
**Input**: Authentication system refactoring.
**Output**:
`## Summary`
`- Migration from local JWT to Auth0.`
`- Cleanup of obsolete login routes.`

`## Architecture`
`Token generation logic is decoupled from the core application, delegating responsibility to the external provider. Validation middleware is updated to support JWKS.`

`## Testing`
`- Verified login/logout flow in staging environment.`
`- Updated unit tests in 'auth.middleware.spec.ts'.`

## Related Capabilities
- @agent/git-specialist
- @rules/root
- @skill/system-sync
