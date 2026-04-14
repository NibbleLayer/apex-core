import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { services } from './services.js';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: text('id').primaryKey(),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  /** HMAC-SHA256 signing key */
  secret: text('secret').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
