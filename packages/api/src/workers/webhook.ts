import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { webhookDeliveries, webhookEndpoints } from '@nibblelayer/apex-persistence/db';
import { getDb } from '../db/resolver.js';

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 5000;

/**
 * Process all pending webhook deliveries.
 * Fetches up to 50 pending deliveries and attempts delivery.
 * Returns the number of successfully delivered webhooks.
 */
export async function processWebhookDeliveries(): Promise<number> {
  const db = await getDb();
  // Fetch pending deliveries
  const pending = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.status, 'pending'))
    .limit(50);

  let processed = 0;

  for (const delivery of pending) {
    // Skip deliveries that have exceeded max attempts (defensive)
    if (delivery.attempts >= MAX_ATTEMPTS) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'dead_lettered', lastAttemptAt: new Date() })
        .where(eq(webhookDeliveries.id, delivery.id));
      continue;
    }

    // Get the webhook endpoint
    const [endpoint] = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, delivery.webhookEndpointId))
      .limit(1);

    if (!endpoint || !endpoint.enabled) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'dead_lettered', lastAttemptAt: new Date() })
        .where(eq(webhookDeliveries.id, delivery.id));
      continue;
    }

    try {
      // Sign payload with HMAC-SHA256
      const payloadStr = JSON.stringify(delivery.payload);
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(payloadStr)
        .digest('hex');

      // Deliver with 10s timeout
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Apex-Signature': `sha256=${signature}`,
          'X-Apex-Event-Type': (delivery.payload as any)?.type || 'unknown',
          'X-Apex-Delivery-Id': delivery.id,
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        await db
          .update(webhookDeliveries)
          .set({
            status: 'delivered',
            attempts: delivery.attempts + 1,
            lastAttemptAt: new Date(),
          })
          .where(eq(webhookDeliveries.id, delivery.id));
        processed++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const newAttempts = delivery.attempts + 1;
      const isDead = newAttempts >= MAX_ATTEMPTS;
      await db
        .update(webhookDeliveries)
        .set({
          attempts: newAttempts,
          status: isDead ? 'dead_lettered' : 'pending',
          lastAttemptAt: new Date(),
          lastError: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(webhookDeliveries.id, delivery.id));
    }
  }

  return processed;
}

/**
 * Start the webhook worker as a background poller.
 * Returns a stop function for graceful shutdown.
 */
export function startWebhookWorker(): () => void {
  console.log('Webhook worker started');
  const timer = setInterval(async () => {
    try {
      const count = await processWebhookDeliveries();
      if (count > 0) {
        console.log(`Delivered ${count} webhooks`);
      }
    } catch (error) {
      console.error('Webhook worker error:', error);
    }
  }, POLL_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    console.log('Webhook worker stopped');
  };
}
