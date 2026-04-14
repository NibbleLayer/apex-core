import { serve } from '@hono/node-server';
import pg from 'pg';
import crypto from 'node:crypto';
import { app } from './app.js';
import { startWebhookWorker } from './workers/webhook.js';

const port = Number(process.env.PORT || 3000);

// ---------------------------------------------------------------------------
// Auto-seed: runs on first boot when no organization exists.
// Creates a default org + API key and prints the key to stdout.
// ---------------------------------------------------------------------------
async function autoSeed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const orgSlug = process.env.ORG_SLUG || 'my-org';
  const orgName = process.env.ORG_NAME || 'My Organization';
  const keyLabel = process.env.KEY_LABEL || 'Admin Key';

  const pool = new pg.Pool({ connectionString });

  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM organizations WHERE slug = $1',
      [orgSlug],
    );

    if (existing.length > 0) {
      console.log(`[seed] Organization "${orgSlug}" already exists — skipping.`);
      return;
    }

    const orgId = `c${crypto.randomBytes(16).toString('hex').slice(0, 24)}`;
    const keyId = `c${crypto.randomBytes(16).toString('hex').slice(0, 24)}`;
    const rawKey = `apex_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await pool.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
      [orgId, orgName, orgSlug],
    );

    await pool.query(
      'INSERT INTO api_keys (id, organization_id, key_hash, label) VALUES ($1, $2, $3, $4)',
      [keyId, orgId, keyHash, keyLabel],
    );

    const dashboardPort = process.env.DASHBOARD_PORT || '8080';
    console.log('');
    console.log('  ==================================================');
    console.log('    API KEY (save this — it will NOT be shown again)');
    console.log('');
    console.log(`    ${rawKey}`);
    console.log('');
    console.log('  ==================================================');
    console.log(`    Organization : ${orgName}`);
    console.log(`    Slug         : ${orgSlug}`);
    console.log(`    Key label    : ${keyLabel}`);
    console.log('');
    console.log(`    Dashboard : http://localhost:${dashboardPort}`);
    console.log(`    API       : http://localhost:${port}`);
    console.log('');
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
(async () => {
  try {
    await autoSeed();
  } catch (err) {
    console.error('[seed] Auto-seed failed:', err instanceof Error ? err.message : err);
  }

  const stopWorker = startWebhookWorker();

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Apex API running on http://localhost:${info.port}`);
  });

  process.on('SIGTERM', () => {
    stopWorker();
    server.close();
  });
})();
