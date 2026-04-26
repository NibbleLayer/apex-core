import { serve } from '@hono/node-server';
import { app } from './app.js';
import { startWebhookWorker } from './workers/webhook.js';

const port = Number(process.env.PORT || 3000);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
(async () => {
  const stopWorker = startWebhookWorker();

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Apex API running on http://localhost:${info.port}`);
  });

  process.on('SIGTERM', () => {
    stopWorker();
    server.close();
  });
})();
