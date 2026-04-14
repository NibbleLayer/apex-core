import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { services } from './services.js';

export const environments = pgTable(
  'environments',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    mode: text('mode', {
      enum: ['test', 'prod'],
    }).notNull(),
    /** CAIP-2 network identifier, e.g., 'eip155:84532' for Base Sepolia */
    network: text('network').notNull(),
    facilitatorUrl: text('facilitator_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('environments_service_mode_unique').on(table.serviceId, table.mode)],
);
