#!/usr/bin/env node
/**
 * Bootstrap seed script — creates the first organization and API key.
 *
 * Usage:
 *   pnpm --filter @nibblelayer/apex-api seed
 *   pnpm --filter @nibblelayer/apex-api seed -- --name "Foo" --slug "foo" --label "Admin"
 *
 * Or from repo root:
 *   pnpm seed
 *   pnpm seed -- --name "Foo" --slug "foo" --label "Admin"
 */

import pg from 'pg';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Helpers (self-contained — no dependency on Drizzle or app modules)
// ---------------------------------------------------------------------------

function createId(): string {
  return `c${crypto.randomBytes(16).toString('hex').slice(0, 24)}`;
}

function generateApiKey(): { rawKey: string; keyHash: string } {
  const bytes = crypto.randomBytes(32);
  const rawKey = `apex_${bytes.toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return { rawKey, keyHash };
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { name: string; slug: string; label: string } {
  const args = { name: 'My Organization', slug: 'my-org', label: 'Default' };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--name':
        args.name = argv[++i] ?? args.name;
        break;
      case '--slug':
        args.slug = argv[++i] ?? args.slug;
        break;
      case '--label':
        args.label = argv[++i] ?? args.label;
        break;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { name, slug, label } = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev';

  const pool = new pg.Pool({ connectionString });

  try {
    // Check if org already exists
    const { rows: existing } = await pool.query(
      'SELECT id FROM organizations WHERE slug = $1',
      [slug],
    );

    if (existing.length > 0) {
      console.log(`\n  Organization "${slug}" already exists — skipping.\n`);
      return;
    }

    const orgId = createId();
    const keyId = createId();
    const { rawKey, keyHash } = generateApiKey();

    // Insert organization
    await pool.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
      [orgId, name, slug],
    );

    // Insert API key
    await pool.query(
      'INSERT INTO api_keys (id, organization_id, key_hash, label) VALUES ($1, $2, $3, $4)',
      [keyId, orgId, keyHash, label],
    );

    console.log('');
    console.log('  ✅  Bootstrap complete');
    console.log('');
    console.log(`  Organization : ${name}`);
    console.log(`  Slug         : ${slug}`);
    console.log(`  Key label    : ${label}`);
    console.log('');
    console.log('  ┌──────────────────────────────────────────────────────────────');
    console.log('  │  API KEY (save this — it will NOT be shown again)');
    console.log('  │');
    console.log(`  │  ${rawKey}`);
    console.log('  └──────────────────────────────────────────────────────────────');
    console.log('');
    console.log('  Use it: curl -H "Authorization: Bearer <key>" http://localhost:3000/...');
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n  ❌ Seed failed:', err.message || err);
  process.exitCode = 1;
});
