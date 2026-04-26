# @nibblelayer/apex-dashboard

Self-hosted admin dashboard for the Apex control plane.

## Purpose

Provides a web interface for:
- Managing organizations and API keys
- Creating and configuring services
- Setting up environments, wallets, and routes
- Configuring pricing and discovery metadata
- Monitoring settlements and webhook deliveries
- Generating SDK tokens and integration snippets

## Tech Stack

- [SolidJS](https://www.solidjs.com/) — Reactive UI framework
- [Vite](https://vitejs.dev/) — Build tool and dev server
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first styling

## Architecture

```
Browser ──▶ Vite Dev Server (:5173)
                │
                ├──▶ /api/* ──▶ Proxy to API (:3000)
                └──▶ /* ──▶ SolidJS SPA
```

## Development

```bash
# From repo root
pnpm dev:dashboard
```

The dev server runs on `http://localhost:5173` and proxies API requests to `http://localhost:3000`.

## Build

```bash
pnpm build
```

## Not Published

This is an internal application, not published to npm. It ships as part of the self-hosted Docker Compose stack.
