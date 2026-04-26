# Contributing to Apex

Thank you for your interest in contributing to Apex! This guide will help you get started with development, understand the project structure, and submit changes that align with our standards.

## Code of Conduct

Be respectful. We follow the [Apache Software Foundation Code of Conduct](https://www.apache.org/foundation/policies/conduct). Treat every contributor with professionalism and courtesy.

## Getting Started

### Prerequisites

- **Node.js** 22 or later
- **pnpm** 10 or later
- **Docker** or **Podman** (with Compose support)

### Clone and Install

```bash
git clone https://github.com/nibblelayer/apex-core.git
cd apex-core
pnpm install --frozen-lockfile
```

### Setup

```bash
pnpm dev
```

This starts PostgreSQL, pushes the schema, seeds the initial organization, and launches both the API and Dashboard.

On first run, an API key is written to `.apex-seed-key`. Use this key to authenticate with the dashboard.

### Run the API only

```bash
pnpm dev:api
```

### Run the Dashboard only

```bash
pnpm dev:dashboard
```

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout main
   git pull
   git checkout -b feat/your-feature
   ```

2. **Make changes** — keep commits atomic and focused on a single logical change.

3. **Verify before pushing**:
   ```bash
   pnpm build && pnpm test && pnpm typecheck
   ```

4. **Commit messages** must follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation changes
   - `test:` — adding or updating tests
   - `refactor:` — code restructuring without behavior change
   - `chore:` — maintenance tasks (dependencies, tooling, configs)

5. **Push and open a Pull Request** against `main` with a clear description of the changes.

## Project Structure

| Directory | Purpose |
| --- | --- |
| `packages/contracts` | Public schemas and types |
| `packages/control-plane-core` | Manifest construction |
| `packages/sdk-hono` | Hono SDK |
| `packages/core` | Database schema and persistence |
| `packages/api` | Self-hosted API |
| `packages/dashboard` | Self-hosted dashboard |

## Public vs Internal Packages

This monorepo distinguishes between **public** (published to npm) and **internal** (private) packages.

**Rules:**

- **Public packages** (`contracts`, `control-plane-core`, `sdk-hono`) **MUST NOT** import from private packages (`core`, `api`, `dashboard`). This boundary is enforced at build time.
- Changes to public packages **must** pass `pnpm typecheck` without errors.
- `pnpm pack:verify` **must** pass — npm tarballs must contain no source or test files (only compiled output and declarations).

## Testing

| Command | Description |
| --- | --- |
| `pnpm test` | Unit tests across all packages |
| `pnpm test:integration` | Integration tests (requires a running database) |
| `pnpm typecheck` | Type checking for public packages |

**Expectations:**

- Write tests for every new feature.
- Write regression tests for every bug fix.
- All tests must pass before a PR is merged.

## Pull Request Process

1. **Ensure CI passes.** The pipeline runs: `build`, `test`, `typecheck`, `pack:verify`, `compose:verify`.
2. **Write a clear description** of what changed and why.
3. **Link related issues** using `Fixes #123` or `Refs #456` syntax.
4. **Public API changes** must include corresponding type and schema updates in `packages/contracts`.

## Releasing (Maintainers Only)

- Version bumps are coordinated across packages in the monorepo.
- Before publishing, run:
  ```bash
  pnpm release:verify
  ```
- This script validates builds, tests, typechecks, pack integrity, and compose configuration.

## License

This project is licensed under [Apache-2.0](LICENSE). By contributing, you agree that your contributions will be licensed under the same terms.
