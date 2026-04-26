# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-25

### Added
- Initial public release of the Apex self-hosted control plane.
- `@nibblelayer/apex-contracts`: Public schemas (Zod) and TypeScript types for Organizations, Services, Environments, Wallets, Routes, Pricing, Discovery, Settlements, Payment Events, and the x402 Manifest.
- `@nibblelayer/apex-control-plane-core`: Manifest builder (`buildManifest`), SHA256 checksum computation (`computeChecksum`), and change detection (`hasManifestChanged`).
- `@nibblelayer/apex-hono`: Hono SDK with `createApexClient` for x402 payment middleware integration, auto-refreshing manifests, idempotency support, and event emission.
- `@nibblelayer/apex-persistence`: Internal database schema with Drizzle ORM (PostgreSQL), migrations, and boundary enforcement.
- `@nibblelayer/apex-api`: Self-hosted REST API with Hono, API key authentication, service/route/pricing/environment management, webhook delivery, and event tracking.
- `@nibblelayer/apex-dashboard`: Self-hosted SolidJS dashboard for organization management, service configuration, and settlement monitoring.
- Docker/Podman Compose stack with PostgreSQL 16, auto-seeding, and health checks.
- CI pipeline (GitHub Actions) covering build, test, typecheck, pack verification, and compose validation.
- Release verification scripts (`release-verify.sh`, `verify-public-packages.sh`, `verify-compose.sh`).
- 297 tests across unit, integration, regression, and boundary categories (default `pnpm test` suite).

[0.1.0]: https://github.com/nibblelayer/apex-core/releases/tag/v0.1.0
