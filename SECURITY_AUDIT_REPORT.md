
================================================================================
                    APEX-CORE SECURITY AUDIT REPORT
           Repository: https://github.com/NibbleLayer/apex-core
================================================================================

OVERVIEW
--------
This audit scanned 270 source files across the apex-core monorepo for security
issues including hardcoded secrets, database credentials, auth weaknesses, and
insecure patterns.

EXECUTIVE SUMMARY
-----------------
  CRITICAL: 25  -> Must be fixed before public release
  WARNING:  8   -> Should be addressed soon
  INFO:     25      -> Positive findings or minor issues

================================================================================
                              CRITICAL FINDINGS
================================================================================

  File:     .apex-seed-key:1
  Category: Apex API Key
  Snippet:  apex_f76fa6295c9e1ec08579135b1b6222c898204b7561f003d7917ede4771fc1a67
  Action:   This is a real API key. Rotate immediately and remove from git history.

  File:     .apex-seed-key:1
  Category: Committed API Seed Key
  Snippet:  apex_f76fa6295c9e1ec08579135b1...
  Action:   This file contains a real API key and is committed to git. Rotate immediately and add to .gitignore.

  File:     compose.yaml:21
  Category: Hardcoded Database Password
  Snippet:  POSTGRES_PASSWORD: apex_dev
  Action:   Use environment variable substitution or secrets. Never hardcode DB passwords in compose files.

  File:     compose.yaml:44
  Category: Database Connection String
  Snippet:  DATABASE_URL: postgresql://apex:apex_dev@postgres:5432/apex_dev
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     compose.yaml:44
  Category: Hardcoded Connection String
  Snippet:  DATABASE_URL: postgresql://apex:apex_dev@postgres:5432/apex_dev
  Action:   Use environment variable substitution for DATABASE_URL.

  File:     compose.yaml:58
  Category: Database Connection String
  Snippet:  DATABASE_URL: postgresql://apex:apex_dev@postgres:5432/apex_dev
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     compose.yaml:58
  Category: Hardcoded Connection String
  Snippet:  DATABASE_URL: postgresql://apex:apex_dev@postgres:5432/apex_dev
  Action:   Use environment variable substitution for DATABASE_URL.

  File:     packages/api/src/db/index.ts:6
  Category: Database Connection String
  Snippet:  connectionString: process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev',
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     packages/api/src/db/index.ts:6
  Category: Hardcoded Database Credentials
  Snippet:  connectionString: process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev',
  Action:   Remove hardcoded fallback database credentials. Force env var usage only.

  File:     packages/api/src/seed.ts:121
  Category: Database Connection String
  Snippet:  const connectionString = process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     packages/api/src/seed.ts:121
  Category: Hardcoded Database Credentials
  Snippet:  const connectionString = process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex
  Action:   Remove hardcoded fallback connection string. Force DATABASE_URL env var.

  File:     packages/api/src/seed.ts:121
  Category: Hardcoded Database Credentials
  Snippet:  const connectionString = process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex
  Action:   Remove hardcoded fallback database credentials. Force env var usage only.

  File:     packages/api/test/setup.ts:6
  Category: Database Connection String
  Snippet:  const connectionString = process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     packages/core/drizzle.config.ts:8
  Category: Database Connection String
  Snippet:  url: process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev',
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     packages/core/drizzle.config.ts:8
  Category: Hardcoded Database Credentials
  Snippet:  url: process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev',
  Action:   Remove hardcoded fallback database credentials. Force env var usage only.

  File:     packages/core/test/db-schema.test.ts:491
  Category: Hardcoded Secret/Token
  Snippet:  secret: 'whsec_abc123def456',
  Action:   Move to environment variables or secrets manager.

  File:     packages/core/test/setup-db.ts:6
  Category: Database Connection String
  Snippet:  process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev';
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     packages/dashboard/src/components/OnboardingWizard.tsx:64
  Category: Hardcoded Secret/Token
  Snippet:  return `export APEX_TOKEN="${token}"\nexport APEX_URL="${deriveApexApiBaseUrl()}"`;
  Action:   Move to environment variables or secrets manager.

  File:     packages/sdk-hono/src/client.ts:19
  Category: Hardcoded API Key
  Snippet:  *   apiKey: 'apex_...',
  Action:   Move to environment variables or secrets manager.

  File:     packages/sdk-hono/test/apex.test.ts:18
  Category: Hardcoded Secret/Token
  Snippet:  const envToken = 'apx_sdk_envtoken123';
  Action:   Move to environment variables or secrets manager.

  File:     packages/sdk-hono/test/apex.test.ts:20
  Category: Hardcoded Secret/Token
  Snippet:  const explicitToken = 'apx_sdk_explicit123';
  Action:   Move to environment variables or secrets manager.

  File:     packages/sdk-hono/test/boundary-contract.test.ts:119
  Category: Hardcoded API Key
  Snippet:  const apiKey = 'apx_sdk_scopedtoken456';
  Action:   Move to environment variables or secrets manager.

  File:     scripts/dev.sh:5
  Category: Database Connection String
  Snippet:  export DATABASE_URL="postgresql://apex:apex_dev@localhost:5433/apex_dev"
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

  File:     scripts/e2e-test.sh:6
  Category: Hardcoded API Key
  Snippet:  API_KEY="${APEX_API_KEY:-}"
  Action:   Move to environment variables or secrets manager.

  File:     scripts/e2e-test.sh:7
  Category: Database Connection String
  Snippet:  DATABASE_URL="postgresql://apex:apex_dev@localhost:5433/apex_dev"
  Action:   Move connection strings to environment variables. Never commit credentials in URLs.

================================================================================
                               WARNING FINDINGS
================================================================================

  File:     packages/api/src/middleware/auth.ts:17
  Category: Full Table Scan on Auth
  Snippet:  const allKeys = await db
  Action:   Loading all API keys into memory is O(n) and does not scale. Use a keyed lookup or caching layer.

  File:     packages/api/src/middleware/auth.ts:25
  Category: Full Table Scan on Auth
  Snippet:  .from(apiKeys);
  Action:   Loading all API keys into memory is O(n) and does not scale. Use a keyed lookup or caching layer.

  File:     packages/api/src/middleware/auth.ts:53
  Category: Raw API Key Stored in Context
  Snippet:  c.set('apiKeyRaw', rawKey);
  Action:   Storing raw API key in context risks accidental logging/exposure. Store only orgId and keyId.

  File:     packages/api/src/seed.ts:96
  Category: Predictable Default Organization
  Snippet:  const args = { name: 'My Organization', slug: 'my-org', label: 'Default' };
  Action:   Default org slug is predictable. Consider requiring explicit configuration.

  File:     packages/core/test/db-schema.test.ts:28
  Category: Insecure Random (Math.random)
  Snippet:  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  Action:   Use crypto.randomBytes() or crypto.getRandomValues() for security-sensitive operations.

  File:     packages/core/test/db-schema.test.ts:491
  Category: Test File Contains Real-Looking Password
  Snippet:  secret: 'whsec_abc123def456',
  Action:   Use obviously fake test values like "test_password" or "fake_secret".

  File:     packages/core/test/db-schema.test.ts:615
  Category: Test File Contains Real-Looking Password
  Snippet:  secret: 'cascade_secret',
  Action:   Use obviously fake test values like "test_password" or "fake_secret".

  File:     packages/sdk-hono/test/boundary-contract.test.ts:226
  Category: Test File Contains Real-Looking Password
  Snippet:  __internal__: { secret: 'nope' },
  Action:   Use obviously fake test values like "test_password" or "fake_secret".

================================================================================
                           INFO / POSITIVE FINDINGS
================================================================================

  File:     docs/ONE_LINE_INTEGRATION.md:14
  Category: Environment Variable Access
  Snippet:  app.use(apex({ token: process.env.APEX_TOKEN }));
  Action:   Ensure required env vars are validated at startup. Check for defaults that might be insecure.

  File:     packages/api/src/crypto.ts:11
  Category: Salt Generation
  Snippet:  salt = randomBytes(32)
  Action:   Good: 32-byte salt is sufficient.

  File:     packages/api/src/crypto.ts:12
  Category: Derived Key Length
  Snippet:  keylen = 64
  Action:   Good: 64-byte derived key provides 512 bits of security.

  File:     packages/api/src/crypto.ts:13
  Category: Scrypt Parameters
  Snippet:  N=16384, r=8, p=1
  Action:   Scrypt params (N=16384, r=8, p=1) are reasonable but consider N=65536 or higher for long-term security.

  File:     packages/api/src/crypto.ts:40
  Category: Constant-Time Comparison
  Snippet:  timingSafeEqual(derivedKey, expectedKey)
  Action:   Good: Uses constant-time comparison to prevent timing attacks.

  File:     packages/api/src/index.ts:5
  Category: Environment Variable Access
  Snippet:  const port = Number(process.env.PORT || 3000);
  Action:   Ensure required env vars are validated at startup. Check for defaults that might be insecure.

  File:     packages/api/src/index.ts:14
  Category: Console Statement
  Snippet:  console.log(`Apex API running on http://localhost:${info.port}`);
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/api/src/index.ts:14
  Category: Internal/Localhost URL
  Snippet:  console.log(`Apex API running on http://localhost:${info.port}`);
  Action:   Ensure internal URLs are not exposed in production configurations.

  File:     packages/api/src/middleware/audit-log.ts:37
  Category: Console Statement
  Snippet:  console.log('[AUDIT]', JSON.stringify(entry));
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/api/src/middleware/error-handler.ts:8
  Category: Console Statement
  Snippet:  console.error('Unhandled error:', err);
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/api/src/seed.ts:37
  Category: Environment Variable Access
  Snippet:  process.env.GIT_ROOT || path.resolve(import.meta.dirname, '../../../'),
  Action:   Ensure required env vars are validated at startup. Check for defaults that might be insecure.

  File:     packages/api/src/seed.ts:143
  Category: Internal/Localhost URL
  Snippet:  console.log('  Use it: curl -H "Authorization: Bearer <key>" http://localhost:3000/...');
  Action:   Ensure internal URLs are not exposed in production configurations.

  File:     packages/api/src/services/usage-service.ts:13
  Category: Console Statement
  Snippet:  console.log('[USAGE]', JSON.stringify({ ...event, period }));
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/api/src/workers/webhook.ts:126
  Category: Console Statement
  Snippet:  console.log('Webhook worker started');
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/api/src/workers/webhook.ts:131
  Category: Console Statement
  Snippet:  console.log(`Delivered ${count} webhooks`);
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/api/src/workers/webhook.ts:134
  Category: Console Statement
  Snippet:  console.error('Webhook worker error:', error);
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/api/src/workers/webhook.ts:140
  Category: Console Statement
  Snippet:  console.log('Webhook worker stopped');
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/sdk-hono/src/apex.ts:33
  Category: Environment Variable Access
  Snippet:  const apiKey = options.token ?? options.apiKey ?? process.env.APEX_TOKEN;
  Action:   Ensure required env vars are validated at startup. Check for defaults that might be insecure.

  File:     packages/sdk-hono/src/apex.ts:34
  Category: Environment Variable Access
  Snippet:  const apexUrl = options.apexUrl ?? process.env.APEX_URL;
  Action:   Ensure required env vars are validated at startup. Check for defaults that might be insecure.

  File:     packages/sdk-hono/src/events.ts:74
  Category: Console Statement
  Snippet:  console.error('Invalid event payload:', validation.error.issues);
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/sdk-hono/src/events.ts:106
  Category: Console Statement
  Snippet:  console.error('Cannot emit Apex payment event before manifest serviceId is known:', type);
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/sdk-hono/src/events.ts:150
  Category: Console Statement
  Snippet:  console.error(
  Action:   Remove or replace with proper logging framework before production.

  File:     packages/sdk-hono/src/middleware.ts:9
  Category: Environment Variable Access
  Snippet:  return process.env.NODE_ENV === 'production';
  Action:   Ensure required env vars are validated at startup. Check for defaults that might be insecure.

  File:     packages/sdk-hono/src/middleware.ts:99
  Category: Console Statement
  Snippet:  console.warn(
  Action:   Remove or replace with proper logging framework before production.

  File:     scripts/verify-release-metadata.sh:12
  Category: Environment Variable Access
  Snippet:  const rootDir = process.env.ROOT_DIR;
  Action:   Ensure required env vars are validated at startup. Check for defaults that might be insecure.

================================================================================
                           DETAILED ANALYSIS
================================================================================

1.  .APEX-SEED-KEY -- COMMITTED API KEY  [CRITICAL]
    -----------------------------------------------------------------------
    File: .apex-seed-key
    Finding: This file contains a real API key and IS tracked by git.
    Impact: Anyone can clone the repo and use this key to access the API.
    Note: .gitignore DOES list .apex-seed-key (line 19), but the file was
          committed BEFORE .gitignore was updated. Git continues tracking it.
    Fix:   1. Rotate the API key immediately (generate a new one)
           2. Run: git rm --cached .apex-seed-key
           3. Verify it is untracked: git status
           4. Consider adding to .gitattributes: .apex-seed-key export-ignore

2.  COMPOSE.YAML -- HARDCODED DB PASSWORDS  [CRITICAL]
    -----------------------------------------------------------------------
    File: compose.yaml (lines 21, 44, 58)
    Finding: POSTGRES_PASSWORD: apex_dev
             DATABASE_URL: postgresql://apex:apex_dev@postgres:5432/apex_dev
    Impact: Default DB password is public knowledge. Any deployment using
            compose.yaml with default values is immediately compromised.
    Fix:   1. Use env var substitution:
             POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
             DATABASE_URL: ${DATABASE_URL}
           2. Provide a .env.example with placeholder values
           3. Document that users MUST set their own passwords

3.  SOURCE CODE -- HARDCODED DB FALLBACKS  [CRITICAL]
    -----------------------------------------------------------------------
    Files: packages/api/src/db/index.ts:6
           packages/api/src/seed.ts:121
           packages/core/drizzle.config.ts:8
           scripts/dev.sh:5
           scripts/e2e-test.sh:7
    Finding: process.env.DATABASE_URL || 'postgresql://apex:apex_dev@...'
    Impact: If DATABASE_URL is unset, the app connects with a public password.
            This is a common deployment footgun.
    Fix:   1. Remove ALL fallback connection strings from source code
           2. Throw an error if DATABASE_URL is missing:
              const dbUrl = process.env.DATABASE_URL;
              if (!dbUrl) throw new Error('DATABASE_URL is required');
           3. Add startup validation that checks required env vars

4.  AUTH MIDDLEWARE -- FULL TABLE SCAN  [WARNING]
    -----------------------------------------------------------------------
    File: packages/api/src/middleware/auth.ts (lines 17-25)
    Finding: Loads ALL api_keys from DB on every authenticated request.
    Impact: O(n) per request. Does not scale. High latency + DB load.
    Fix:   1. Add a prefix/index field to api_keys table
           2. Extract a prefix from the raw key (e.g., first 8 chars)
           3. Query only keys matching that prefix: WHERE key_prefix = ?
           4. Then verify with scrypt in-memory
           5. Consider Redis caching for active keys

5.  AUTH MIDDLEWARE -- RAW KEY IN CONTEXT  [WARNING]
    -----------------------------------------------------------------------
    File: packages/api/src/middleware/auth.ts (line 53)
    Finding: c.set('apiKeyRaw', rawKey)
    Impact: Raw API key is accessible to any downstream middleware/route.
            Accidental logging could leak it. Request dumps would expose it.
    Fix:   Remove this line. Store only: organizationId, apiKeyId, apiKeyLabel.
           Routes should never need the raw key.

6.  CRYPTO.TS -- SECURITY ASSESSMENT  [INFO/GOOD]
    -----------------------------------------------------------------------
    File: packages/api/src/crypto.ts
    Findings:
      + Uses scrypt (memory-hard KDF) -- good choice
      + Uses randomBytes(32) for salt -- sufficient entropy
      + Uses timingSafeEqual -- prevents timing attacks
      + Key length 64 bytes -- adequate
      ~ Scrypt params: N=16384 (2^14). OWASP recommends N>=65536 (2^16)
          for new systems. Current params are acceptable but not ideal.
    Verdict: Secure implementation. Consider increasing N to 65536.

7.  SEED.TS -- PREDICTABLE DEFAULTS  [WARNING]
    -----------------------------------------------------------------------
    File: packages/api/src/seed.ts (line 96)
    Finding: Default org slug = 'my-org', name = 'My Organization'
    Impact: Predictable defaults make it easier for attackers to guess
            organization identifiers. Not a direct vulnerability but weak.
    Fix:   Require explicit --name, --slug, --label arguments.
           Remove defaults or make them random.

8.  TEST FILES  [INFO]
    -----------------------------------------------------------------------
    Finding: Many test files contain hardcoded-looking values.
    Verdict: MOST are clearly fake (apex_testkey123, 0x1234567890abcdef...).
            The USDC contract address 0x833589fCD... is a PUBLIC testnet
            address (Base Sepolia) -- not a secret.
    Minor concern: 'whsec_abc123def456' in db-schema.test.ts looks
        like a real webhook secret format. Use 'whsec_test_fake' instead.

9.  RAW SQL -- FALSE POSITIVE  [INFO]
    -----------------------------------------------------------------------
    The audit flagged many "Raw SQL Query" findings in routes/*.ts.
    These are FALSE POSITIVES. The code uses Drizzle ORM's query builder
    which parameterizes queries automatically. The .query() calls are
    for reading HTTP query parameters, not raw SQL.

10. CONSOLE.LOG IN PRODUCTION CODE  [INFO]
    -----------------------------------------------------------------------
    Multiple console.log/error/warn statements exist in production source.
    These are not secrets but should be replaced with a structured logger
    (e.g., pino, winston) before production deployment.

================================================================================
                           PRIORITY ACTION PLAN
================================================================================

IMMEDIATE (before public release):
  [ ] 1. Rotate .apex-seed-key and purge from git history
          git filter-branch --force --index-filter \
            'git rm --cached --ignore-unmatch .apex-seed-key' HEAD
          OR use BFG Repo-Cleaner for large repos
  [ ] 2. Remove hardcoded DB password from ALL source files
  [ ] 3. Add env var validation at application startup
  [ ] 4. Change compose.yaml to use env var substitution
  [ ] 5. Remove raw API key from auth context (auth.ts line 53)

SHORT-TERM (next sprint):
  [ ] 6. Fix auth middleware full table scan (add key prefix index)
  [ ] 7. Increase scrypt N from 16384 to 65536
  [ ] 8. Replace console.* with structured logger
  [ ] 9. Add rate limiting to API (prevent brute force)
  [ ] 10. Make seed defaults random or require explicit input

================================================================================
                           VERIFICATION CHECKLIST
================================================================================

After fixes, verify with:
  git log --all --full-history -- .apex-seed-key    # Should be empty
  grep -r "apex_dev" --include="*.ts" --include="*.js" --include="*.sh" --include="*.yaml"
  grep -r "c.set('apiKeyRaw'" packages/api/src/
  grep -r "process.env.DATABASE_URL ||" packages/ scripts/

================================================================================
                              END OF REPORT
================================================================================
