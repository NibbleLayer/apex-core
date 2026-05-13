# CLI & Auth Architecture Spec

## Status: Draft

**Objective**: Define a production-grade `apex` CLI and a dual-model authentication architecture that:
- Replaces bash-only onboarding with a real CLI binary
- Separates human auth (sessions/OIDC) from machine auth (API keys)
- Eliminates API-key-in-localStorage for dashboard login
- Provides secure bootstrap for self-hosted deployments
- Keeps API keys only for automation, service accounts, and break-glass recovery

---

## 1. Current State Analysis

### Problems identified

| Problem | Location | Impact |
|---------|----------|--------|
| No real CLI, only bash scripts | `scripts/*.sh` | Not extensible, not product-grade |
| Dashboard stores API key in localStorage | `dashboard/src/api/client.ts:25` | XSS-vulnerable, no session expiry |
| No user concept — only org + API key | DB schema, auth middleware | Cannot track person identity |
| No session layer | API routes | Every request re-validates API key |
| Login sends raw API key to `/auth/login` | `dashboard/src/api/client.ts:80` | Key transmitted as plaintext body |
| Bootstrap API key never expires | `seed.ts` | Permanent admin key after install |

### Current auth flow

```
Browser                    API
  │                         │
  │  POST /auth/login       │
  │  { api_key: "apex_..."} │
  │                         │→ verify key hash
  │  { orgId, name, slug }  │
  │                         │
  │  Store in localStorage  │
  │  Bearer on every request│
  │────────────────────────►│→ verify key on every request
  │                         │
```

---

## 2. Target Auth Architecture

```
                  ┌──────────────────────┐
                  │   Human (Dashboard)   │
                  └──────┬───────────────┘
                         │
              ┌──────────▼──────────┐
              │   Session Auth       │
              │   HttpOnly Cookie    │
              │   OIDC / Email+pw    │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   API Server         │
              │   validates session  │
              └─────────────────────┘

                  ┌──────────────────────┐
                  │   CLI (Developer)     │
                  └──────┬───────────────┘
                         │
              ┌──────────▼──────────┐
              │   CLI Login Flow     │
              │   Browser / Device   │
              │   OS Keychain Store  │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   API Key Auth       │
              │   (Bearer Token)     │
              └─────────────────────┘

                  ┌──────────────────────┐
                  │   Machine (CI/CD)     │
                  └──────┬───────────────┘
                         │
              ┌──────────▼──────────┐
              │   API Key Auth       │
              │   Scoped Tokens      │
              │   (no sessions)      │
              └─────────────────────┘
```

---

## 3. `apex` CLI Architecture

### Package structure

```
packages/cli/
  package.json              ← @nibblelayer/apex-cli (private/internal)
  bin/
    apex.js                 ← binary entry: #!/usr/bin/env node
  src/
    index.ts                ← CLI entry, arg parser (commander or citty)
    commands/
      quickstart.ts         ← interactive onboarding
      doctor.ts             ← health checks
      status.ts             ← show current state
      reset.ts              ← local state reset

      auth/
        login.ts            ← login flow (browser + device-code)
        logout.ts           ← clear stored session
        whoami.ts           ← show current identity

      profile/
        list.ts             ← list available network profiles
        use.ts              ← set active profile

      services/
        list.ts             ← list services
        create.ts           ← create service
        get.ts              ← show service detail

      tokens/
        create.ts           ← create API key / SDK token
        list.ts             ← list tokens
        revoke.ts           ← revoke token

      install.ts            ← first-time bootstrap (supersedes seed)

    config/
      store.ts              ← local JSON config file manager
      keychain.ts           ← OS keychain integration (keytar or similar)

    auth/
      session-client.ts     ← manage login sessions for CLI
      browser-launcher.ts   ← open browser for auth
      http.ts               ← HTTP client (with auth)

    output/
      table.ts              ← table formatter
      json.ts               ← JSON output
      text.ts               ← plain text output
```

### CLI binary entry

```typescript
#!/usr/bin/env node
// bin/apex.js

import { run } from '../src/index.js';
run(process.argv.slice(2));
```

### Commands — first iteration (read-heavy)

```bash
apex status            # show stack health, active profile, org
apex doctor            # check prerequisites
apex profile list      # show available network profiles
apex profile use       # set active profile
apex auth whoami       # show current identity
apex services list     # list services
```

### Commands — second iteration (write)

```bash
apex quickstart        # interactive onboarding (wraps current flow)
apex reset             # destroy local state
apex auth login        # authenticate
apex auth logout       # deauthenticate
apex tokens create     # create API key
apex tokens revoke     # revoke API key
```

### Workspace integration

The CLI lives in the monorepo initially:

```bash
pnpm apex status
pnpm apex profile list
```

Eventually distributable as `npx @nibblelayer/apex-cli` or standalone binary.

---

## 4. Session Auth Architecture

### New DB models

#### `users` table

```typescript
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),     // nullable — OIDC users may not have one
  oidcSub: text('oidc_sub'),               // OIDC subject identifier
  oidcProvider: text('oidc_provider'),      // e.g., 'google', 'github'
  role: varchar('role', { length: 20 }).notNull().default('admin'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

#### `sessions` table

```typescript
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),       // session token (hashed)
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Updated `api_keys` table

Add:

```typescript
keyType: varchar('key_type', { length: 20 }).notNull().default('admin'),
  // 'admin' | 'service' | 'bootstrap'
scope: text('scope').array().notNull().default(sql`ARRAY[]::text[]`),
  // e.g., ['services:read', 'tokens:write']
userId: text('user_id').references(() => users.id),  // nullable — machine keys have no user
expiresAt: timestamp('expires_at', { withTimezone: true }),
```

### Session API

```
POST   /auth/session/login       ← form login (email + password)
POST   /auth/session/oidc        ← OIDC callback
POST   /auth/session/logout      ← destroy session, clear cookie
GET    /auth/session/me          ← current user info (replaces /auth/me)

Cookie: apex_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400
```

### Session middleware

```typescript
// middleware/session.ts
// 1. Read apex_session cookie
// 2. Look up session by hashed token in DB
// 3. If valid and not expired → set userId, orgId, role on context
// 4. If invalid/expired → return 401
// 5. Slide expiry on each request
```

### Login flow (form-based)

```
Browser                     API
  │                          │
  │  POST /auth/session/login│
  │  { email, password }     │
  │                          │→ verify credentials
  │                          │→ create session (DB)
  │  Set-Cookie: apex_s=...  │→ return user info
  │                          │
  │  GET /api/services       │
  │  Cookie: apex_s=...      │
  │                          │→ validate session (middleware)
  │  { services: [...] }     │
```

### Login flow (OIDC)

```
Browser                     API                    OIDC Provider
  │                          │                        │
  │  GET /auth/oidc/{provider}│                       │
  │                          │→ redirect              │
  │  ← redirect to provider  │                        │
  │──────────────────────────►                        │
  │  ← auth code             │                        │
  │                          │                        │
  │  POST /auth/session/oidc │                        │
  │  { code, provider }      │                        │
  │                          │→ exchange code        │
  │                          │→ verify identity       │
  │                          │→ create/update user    │
  │                          │→ create session        │
  │  Set-Cookie: apex_s=...  │                        │
```

---

## 5. CLI Auth Flows

### Flow A: Browser-based login (recommended)

```
CLI                          API                    Browser (user)
 │                            │                        │
 │  apex auth login           │                        │
 │  → start local OAuth       │                        │
 │    listener on :14567      │                        │
 │  → open URL in browser     │                        │
 │────────────────────────────►───────────────────────►│
 │                            │                        │
 │  (user logs in via UI)     │                        │
 │                            │                        │
 │  ← callback with code      │                        │
 │  POST /auth/cli/exchange   │                        │
 │  { code }                  │                        │
 │                            │→ validate code         │
 │                            │→ create CLI session    │
 │  { session_token, org }    │                        │
 │                            │                        │
 │  Store token in OS         │                        │
 │  keychain (encrypted)      │                        │
 │  Done.                     │                        │
```

### Flow B: Device code (headless)

```
CLI                          API
 │                            │
 │  POST /auth/device/code    │
 │                            │→ generate device code
 │  { code: "ABCD-1234",     │
 │    url: "https://..." }    │
 │                            │
 │  Print:                    │
 │  "Visit https://...       │
 │   Enter code: ABCD-1234"  │
 │                            │
 │  (user visits URL on       │
 │   another device, enters   │
 │   code, authenticates)     │
 │                            │
 │  POST /auth/device/poll    │
 │  { code: "ABCD-1234" }    │
 │                            │→ check if authenticated
 │  { session_token, org }    │→ yes, return token
 │                            │
 │  Store in keychain.        │
```

### Flow C: API key (fallback)

```
CLI                          API
 │                            │
 │  apex auth login --key     │
 │  Prompt: "Enter API key"  │
 │  │                        │
 │  POST /auth/login         │
 │  { api_key: "apex_..." } │
 │                            │→ validate key
 │  { organizationId, name } │
 │                            │
 │  Store in keychain.        │
 │  Warn: "API keys are for  │
 │   automation. Consider    │
 │   browser login instead." │
```

---

## 6. Bootstrap Flow (First Install)

### Current bootstrap (seed.ts)

```
pnpm seed
  → creates org "My Organization"
  → creates admin API key
  → writes to .apex-seed-key
  → prints key to console
  → user copies key, pastes in dashboard login
```

### Target bootstrap

```
apex install
  → starts local Postgres
  → runs migrations
  → prompts for admin email and name
  → creates org, user, and temporary bootstrap key
  → prints one-time setup link:
      "Open http://localhost:3000/setup?code=XXXX to complete setup"
  → user visits link, sets password, completes registration
  → bootstrap key/code expires after 15 minutes
  → user is logged in via session
```

### For self-hosted production

```
apex install --production
  → prompts for admin email, password
  → creates org, user with password
  → enables session auth, disables API-key login for humans
  → prints:
      "Setup complete. Login at https://your-apex-instance.com"
```

---

## 7. Migration Plan

### Phase 1 — CLI foundation (no auth changes)
1. Scaffold `packages/cli/` with TypeScript + binary entry
2. Implement `apex status`, `apex doctor`, `apex profile list`
3. Integrate with existing bash scripts where needed
4. Add config store (`~/.apex/config.json`)

### Phase 2 — Human auth
1. Add `users` + `sessions` tables, run migration
2. Implement session login/logout endpoints
3. Implement session middleware
4. Add `email + password` login form to dashboard
5. Migrate dashboard auth to use sessions
6. Add login page that sets HttpOnly cookie

### Phase 3 — CLI auth
1. Implement `apex auth login` (browser flow)
2. Implement OS keychain integration
3. Implement `apex auth whoami`, `apex auth logout`
4. Add `apex tokens create` / `apex tokens revoke`

### Phase 4 — Bootstrap upgrade
1. Implement `apex install` command
2. Update seed flow to create a user + temporary code
3. Add setup completion page to dashboard
4. Deprecate direct `.apex-seed-key` usage

### Phase 5 — Production hardening
1. Add OIDC provider support (Google, GitHub, custom)
2. Implement rate limiting on login endpoints
3. Add session rotation and expiry policies
4. Deprecate API-key-in-localStorage for dashboard
5. Keep API keys only for automation + break-glass

---

## 8. Auth Decision Matrix

| Context | Auth Method | Storage | Expiry |
|---------|------------|---------|--------|
| Dashboard (browser) | Session cookie (HttpOnly) | Cookie | 24h / logout |
| CLI (developer) | Session token in OS keychain | Encrypted | 30d / refresh |
| CLI (CI/CD) | Scoped API key | Env / secrets | Configurable |
| SDK runtime | SDK token | Manifest-backed | Per-service |
| Automation | Service API key | Config | Configurable |
| Bootstrap | One-time code | Memory | 15min |

---

## 9. Open Questions

1. Should `apex` CLI be a published npm package? → Yes, eventually `npx @nibblelayer/apex-cli`
2. Should email+password be required or optional? → Optional; OIDC can be primary
3. Should we support magic-link auth? → Future phase
4. Should CLI store session tokens in OS keychain or encrypted file? → OS keychain preferred, encrypted file fallback
5. Should the same binary serve both local and remote instances? → Yes, via `--host` flag or config

---

## 10. Future Extensions

- Magic-link / passwordless email auth
- Multi-org support for a single user
- Team management (invite, roles)
- Audit log for all auth events
- SCIM provisioning for enterprise
- CLI plugins system
- Standalone binary distribution (pkg, bun build)
