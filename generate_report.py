#!/usr/bin/env python3
"""Generate the final executive security report."""

import json

with open('security_audit_report.json') as f:
    data = json.load(f)

# Filter out audit script self-matches and false positives
def is_false_positive(d):
    snippet = d['snippet']
    filepath = d['file']
    
    if filepath.startswith('security_audit.py'):
        return True
    if filepath == '.dockerignore' and d['category'] == 'Environment File':
        return True
    if d['category'] == 'Internal/Localhost URL' and 'test' in filepath.lower():
        return True
    if d['category'] == 'Internal/Localhost URL' and filepath.startswith('scripts/'):
        return True
    if d['category'] == 'Internal/Localhost URL' and filepath == 'packages/dashboard/vite.config.ts':
        return True
    if d['category'] == 'Internal/Localhost URL' and filepath == 'compose.yaml':
        return True
    if d['category'] == 'Console Statement' and 'test' in filepath.lower():
        return True
    if filepath == 'packages/api/src/seed.ts' and d['category'] == 'Console Statement':
        return True
    if filepath.startswith('scripts/') and d['category'] in ['Raw SQL Query', 'Console Statement', 'Internal/Localhost URL']:
        return True
    if d['category'] == 'Raw SQL Query' and 'c.req.query' in snippet:
        return True
    if d['severity'] == 'CRITICAL' and 'test' in filepath.lower():
        fake_indicators = ['test', 'fake', 'mock', 'dummy', 'example', 'invalid', 
            '0xusdc_contract_address', 'apex_invalid', 'apex_admin_123',
            '0x1234567890abcdef1234567890abcdef12345678',
            '0x0000000000000000000000000000000000000001',
            'apex_test', 'apex_testkey', 'apx_sdk_test', 'apex_sdk_',
            'whsec_test', 'apex_legacykey', 'apex_extra_fields', 'apex_oss_local',
            'apex_hosted_test', 'apex_shape_test', 'cascade_secret', 'nope']
        if any(ind in snippet.lower() for ind in fake_indicators):
            return True
    if '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' in snippet or '0x036CbD53842c5426634e7929541eC2318f3dCF7e' in snippet:
        return True
    if d['category'] in ['TODO/FIXME Comment'] and 'test' in filepath.lower():
        return True
    if d['category'] == 'Environment Variable Access' and 'test' in filepath.lower():
        return True
    if d['category'] == 'Default/Weak Password' and '0x' in snippet and 'test' in filepath.lower():
        return True
    return False

filtered = [d for d in data if not is_false_positive(d)]

for d in filtered:
    if d['category'] == 'Database Connection String' and 'test' not in d['file'].lower():
        d['severity'] = 'CRITICAL'
    if d['category'] == 'Environment Variable Access' and 'apex_dev' in d['snippet'] and 'test' not in d['file'].lower():
        d['severity'] = 'CRITICAL'
        d['category'] = 'Hardcoded Database Credentials'
        d['recommendation'] = 'Remove hardcoded fallback database credentials. Force env var usage only.'

severity_order = {'CRITICAL': 0, 'WARNING': 1, 'INFO': 2}
filtered.sort(key=lambda x: (severity_order.get(x['severity'], 3), x['file'], x['line']))

critical = [d for d in filtered if d['severity'] == 'CRITICAL']
warnings = [d for d in filtered if d['severity'] == 'WARNING']
info = [d for d in filtered if d['severity'] == 'INFO']

report = f"""
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
  CRITICAL: {len(critical)}  -> Must be fixed before public release
  WARNING:  {len(warnings)}   -> Should be addressed soon
  INFO:     {len(info)}      -> Positive findings or minor issues

================================================================================
                              CRITICAL FINDINGS
================================================================================
"""

for f in critical:
    report += f"""
  File:     {f['file']}:{f['line']}
  Category: {f['category']}
  Snippet:  {f['snippet'][:100]}
  Action:   {f['recommendation']}
"""

if warnings:
    report += """
================================================================================
                               WARNING FINDINGS
================================================================================
"""
    for f in warnings:
        report += f"""
  File:     {f['file']}:{f['line']}
  Category: {f['category']}
  Snippet:  {f['snippet'][:100]}
  Action:   {f['recommendation']}
"""

if info:
    report += """
================================================================================
                           INFO / POSITIVE FINDINGS
================================================================================
"""
    for f in info:
        report += f"""
  File:     {f['file']}:{f['line']}
  Category: {f['category']}
  Snippet:  {f['snippet'][:100]}
  Action:   {f['recommendation']}
"""

report += """
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
          git filter-branch --force --index-filter \\
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
"""

print(report)

with open('security_audit_executive.json', 'w') as f:
    json.dump({
        'summary': {'critical': len(critical), 'warning': len(warnings), 'info': len(info)},
        'critical': critical,
        'warnings': warnings,
        'info': info
    }, f, indent=2)

with open('SECURITY_AUDIT_REPORT.md', 'w') as f:
    f.write(report)

print('\nReports saved:')
print('  - security_audit_executive.json (machine readable)')
print('  - SECURITY_AUDIT_REPORT.md (human readable)')
