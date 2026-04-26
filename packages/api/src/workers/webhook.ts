import { eq, and, isNull, lte, or } from 'drizzle-orm';
import { webhookDeliveries, webhookEndpoints } from '@nibblelayer/apex-persistence/db';
import { getDb } from '../db/resolver.js';
import { signWebhookPayload } from '../services/webhook-signing.js';

const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 5000;

export function calculateNextAttemptAt(attempts: number, now = new Date()): Date {
  const delaySeconds = Math.min(60 * 60, 2 ** Math.max(attempts - 1, 0) * 30);
  return new Date(now.getTime() + delaySeconds * 1000);
}

/**
 * Process all pending webhook deliveries.
 * Fetches up to 50 pending deliveries and attempts delivery.
 * Returns the number of successfully delivered webhooks.
 */
export async function processWebhookDeliveries(): Promise<number> {
  const db = await getDb();
  const now = new Date();
  // Fetch pending deliveries
  const pending = await db
    .select()
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, 'pending'),
        or(isNull(webhookDeliveries.nextAttemptAt), lte(webhookDeliveries.nextAttemptAt, now)),
      ),
    )
    .limit(50);

  let processed = 0;

  for (const delivery of pending) {
    // Skip deliveries that have exceeded max attempts (defensive)
    if (delivery.attempts >= MAX_ATTEMPTS) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'dead_lettered', lastAttemptAt: new Date(), nextAttemptAt: null })
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
        .set({ status: 'dead_lettered', lastAttemptAt: new Date(), nextAttemptAt: null })
        .where(eq(webhookDeliveries.id, delivery.id));
      continue;
    }

    try {
      const payloadStr = JSON.stringify(delivery.payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = signWebhookPayload({
        secret: endpoint.secret,
        timestamp,
        deliveryId: delivery.id,
        body: payloadStr,
      });

      // Deliver with 10s timeout
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Apex-Signature': signature,
          'X-Apex-Timestamp': timestamp,
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
            deliveredAt: new Date(),
            nextAttemptAt: null,
            lastError: null,
          })
          .where(eq(webhookDeliveries.id, delivery.id));
        processed++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const newAttempts = delivery.attempts + 1;
      const isDead = newAttempts >= MAX_ATTEMPTS;
      const attemptAt = new Date();
      await db
        .update(webhookDeliveries)
        .set({
          attempts: newAttempts,
          status: isDead ? 'dead_lettered' : 'pending',
          lastAttemptAt: attemptAt,
          nextAttemptAt: isDead ? null : calculateNextAttemptAt(newAttempts, attemptAt),
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
