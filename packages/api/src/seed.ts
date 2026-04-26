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
import fs from 'node:fs';
import path from 'node:path';
import { hashApiKey } from './crypto.js';

// ---------------------------------------------------------------------------
// Helpers (self-contained — no dependency on Drizzle or app modules)
// ---------------------------------------------------------------------------

export function createId(): string {
  return `c${crypto.randomBytes(16).toString('hex').slice(0, 24)}`;
}

export async function generateApiKey(): Promise<{ rawKey: string; keyHash: string; keyPrefix: string }> {
  const bytes = crypto.randomBytes(32);
  const rawKey = `apex_${bytes.toString('hex')}`;
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);
  return { rawKey, keyHash, keyPrefix };
}

export function getSeedKeyFilePath(): string {
  return path.resolve(
    process.env.GIT_ROOT || path.resolve(import.meta.dirname, '../../../'),
    '.apex-seed-key',
  );
}

export async function writeSeedKey(rawKey: string): Promise<void> {
  try {
    fs.writeFileSync(getSeedKeyFilePath(), rawKey, 'utf-8');
  } catch {
    // Non-fatal
  }
}

export async function bootstrapOrg(params: {
  connectionString: string;
  name: string;
  slug: string;
  label: string;
}): Promise<{ orgId: string; keyId: string; rawKey: string } | null> {
  const { connectionString, name, slug, label } = params;
  const pool = new pg.Pool({ connectionString });

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM organizations WHERE slug = $1',
      [slug],
    );

    if (existing.length > 0) {
      return null; // Already exists
    }

    const orgId = createId();
    const keyId = createId();
    const { rawKey, keyHash, keyPrefix } = await generateApiKey();

    await pool.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
      [orgId, name, slug],
    );

    await pool.query(
      'INSERT INTO api_keys (id, organization_id, key_hash, key_prefix, label) VALUES ($1, $2, $3, $4, $5)',
      [keyId, orgId, keyHash, keyPrefix, label],
    );

    await writeSeedKey(rawKey);

    return { orgId, keyId, rawKey };
  } finally {
    await pool.end();
  }
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
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const result = await bootstrapOrg({ connectionString, name, slug, label });

  if (result === null) {
    console.log(`\n  Organization "${slug}" already exists — skipping.\n`);
    return;
  }

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
  console.log(`  │  ${result.rawKey}`);
  console.log('  └──────────────────────────────────────────────────────────────');
  console.log('');
  console.log('  Use it: curl -H "Authorization: Bearer <key>" http://localhost:3000/...');
  console.log('');
}

// Only run main() when this file is executed directly (not imported)
const isMain = import.meta.url === `file://${process.argv[1]}` || import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (isMain) {
  main().catch((err) => {
    console.error('\n  ❌ Seed failed:', err.message || err);
    process.exitCode = 1;
  });
}
