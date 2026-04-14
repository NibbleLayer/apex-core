import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { services } from './services.js';
import { routes } from './routes.js';
import { paymentEvents } from './payment-events.js';

export const settlements = pgTable('settlements', {
  id: text('id').primaryKey(),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  routeId: text('route_id')
    .notNull()
    .references(() => routes.id, { onDelete: 'cascade' }),
  paymentEventId: text('payment_event_id')
    .notNull()
    .references(() => paymentEvents.id, { onDelete: 'cascade' }),
  amount: text('amount').notNull(),
  token: text('token').notNull(),
  /** CAIP-2 network identifier */
  network: text('network').notNull(),
  /** Transaction hash from facilitator */
  settlementReference: text('settlement_reference'),
  status: text('status', {
    enum: ['pending', 'confirmed', 'failed'],
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
