# apex-core

Self-hosted Apex control plane for x402-powered services.

`apex-core` is the active public repository for the Apex OSS boundary. It ships the self-hosted control plane, the seller-facing Hono SDK, and the public contracts/kernel packages needed to build and operate payable services without depending on NibbleLayer-managed infrastructure.

`apex-managed` is a separate repository and is fully out of scope here.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/NibbleLayer/apex-core.git
cd apex-core
pnpm install

# 2. Start guided local onboarding
pnpm quickstart
```

`pnpm quickstart` is the primary onboarding entrypoint. It guides local setup, explains planned `.env` or reset changes before applying them, prebuilds required workspace artifacts, starts the local PostgreSQL-backed stack, and can optionally add demo sample data.

On first run, an API key is written to `.apex-seed-key`. Use this key to authenticate with the dashboard.

- API: `http://localhost:3000`
- Dashboard: `http://localhost:5173`

## What is Apex?

Apex is an x402 control plane: one-line SDK integration in seller APIs, with route pricing, facilitator/network selection, discovery metadata, events, settlements, and publish workflows managed through the control plane.

### Architecture Overview

```
Dashboard (SolidJS) ←→ API (Hono) ←→ PostgreSQL
        ↑                    ↑
        │                    ├── Network Registry
        │                    │   (apex-network + EVM adapter)
        │                    │
        │                    ↓
        │              SDK (@nibblelayer/apex-hono)
        │                    ↓
        └────────── Seller's Hono API (x402 payments)
```

The Dashboard is the operator UI. The API is the central Hono-based control plane. The SDK wraps a seller's existing Hono API with x402 payment verification, reading route pricing and manifests from the control plane. PostgreSQL persists all service configuration, events, and settlements.

### Documentation

- [Product Architecture](./docs/PRODUCT_ARCHITECTURE.md)
- [One-Line Integration Contract](./docs/ONE_LINE_INTEGRATION.md)
- [Apex vs Base x402](./docs/X402_COMPARISON.md)
- [Business Repository Boundary](./docs/BUSINESS_REPO_BOUNDARY.md)
- [Implementation Roadmap](./docs/IMPLEMENTATION_ROADMAP.md)
- [Publication Readiness](./docs/PUBLICATION_READINESS.md)
- [Network Adapter Architecture](./docs/architecture/NETWORK_ADAPTER_SPEC.md)
- [CLI & Auth Architecture](./docs/architecture/CLI_AUTH_SPEC.md)

## Requirements

- Node.js 22
- pnpm 10
- Docker Compose or Podman Compose for container verification

## Detailed Setup

### Local development

```bash
pnpm install --frozen-lockfile
pnpm quickstart
```

This creates or updates a local onboarding `.env` when approved, starts containerized PostgreSQL on `localhost:5433`, pushes the schema, seeds the initial organization, prebuilds required internal workspace artifacts, and launches both the API and Dashboard.

On first run, an API key is written to `.apex-seed-key`. Use this key to authenticate with the dashboard.

- API: `http://localhost:3000`
- Dashboard: `http://localhost:5173`

Useful quickstart variants:

```bash
pnpm quickstart -- --minimal   # local stack only, no demo sample data
pnpm quickstart -- --demo      # guided onboarding plus demo sample data
pnpm quickstart -- --doctor    # prerequisite checks only
pnpm quickstart -- --reset     # local-safe reset of Apex DB/container state
pnpm quickstart -- --yes       # auto-confirm local-safe prompts
```

`pnpm dev`, `pnpm stop`, and `pnpm seed` remain available for advanced/manual workflows, but `pnpm quickstart` is the preferred public entrypoint.

### What's Included in the Optional Demo

If you approve the optional demo step, quickstart creates a complete sample environment:

- An organization and API key
- A sample service (e.g., Weather API) with routes and pricing rules
- A test environment on Base Sepolia
- A wallet destination for receiving payments
- A signed manifest ready for SDK consumption

This lets you explore the full seller journey—from service creation to manifest publication—without manual configuration.

### Containerized stack

Build workspace artifacts first, then start the stack:

```bash
pnpm build
podman compose up --build
# or
docker compose up --build
```

- API: `http://localhost:3000`
- Dashboard: `http://localhost:8080`

Stop the stack with:

```bash
pnpm stop
```

Remove volumes as well with:

```bash
pnpm stop -- --volumes
```

Need script help or flags? Use:

```bash
pnpm stop --help
```

## Verification

Run the public release verification set from the repository root:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm pack:verify
pnpm compose:verify
```

`pnpm typecheck` is intentionally scoped to the publishable package surface.

Or run the combined helper:

```bash
pnpm release:verify
```

For the minimal self-host integration check against a running stack:

```bash
pnpm e2e
```

## Public Packages

| Package | Purpose |
| --- | --- |
| `@nibblelayer/apex-contracts` | Public schemas and transport-facing types shared across Apex integrations. |
| `@nibblelayer/apex-control-plane-core` | Public manifest construction helpers for control-plane consumers. |
| `@nibblelayer/apex-hono` | Public Hono SDK for seller runtime integration. |
| `@nibblelayer/apex-network` | Chain adapter interfaces and network profile registry. |
| `@nibblelayer/apex-network-evm` | EVM adapter with built-in profiles for Base and Ethereum. |

### Internal packages and apps

| Workspace | Status |
| --- | --- |
| `@nibblelayer/apex-persistence` | Internal database support package. Not publishable. |
| `@nibblelayer/apex-api` | Internal self-hosted API application. |
| `@nibblelayer/apex-dashboard` | Internal self-hosted dashboard application. |

## Reproducibility notes

- Root scripts resolve the workspace from their own script location and only fall back to `git` when needed.
- Public package tarballs are verified to include only publish-safe artifacts.
- Compose verification checks the committed `compose.yaml` without starting containers.
- CI uses Node 22 and the same release-verification primitives exposed locally.

## Package-level documentation

- [`packages/contracts/README.md`](./packages/contracts/README.md)
- [`packages/control-plane-core/README.md`](./packages/control-plane-core/README.md)
- [`packages/sdk-hono/README.md`](./packages/sdk-hono/README.md)
- [`packages/network/README.md`](./packages/network/README.md)
- [`packages/network-evm/README.md`](./packages/network-evm/README.md)

## License

This repository is released under the [Apache License 2.0](./LICENSE).
