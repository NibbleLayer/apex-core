import { pgTable, text, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { webhookEndpoints } from './webhook-endpoints.js';
import { paymentEvents } from './payment-events.js';

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'pending',
  'delivered',
  'failed',
  'dead_lettered',
]);

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookEndpointId: text('webhook_endpoint_id')
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  eventId: text('event_id')
    .notNull()
    .references(() => paymentEvents.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  status: webhookDeliveryStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
