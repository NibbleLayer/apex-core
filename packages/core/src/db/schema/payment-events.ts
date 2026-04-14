import { pgTable, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { services } from './services.js';
import { routes } from './routes.js';

export const paymentEvents = pgTable(
  'payment_events',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    routeId: text('route_id')
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: [
        'payment.required',
        'payment.verified',
        'payment.settled',
        'payment.failed',
        'payment.replay',
      ],
    }).notNull(),
    requestId: text('request_id').notNull(),
    paymentIdentifier: text('payment_identifier'),
    buyerAddress: text('buyer_address'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('payment_events_service_created_idx').on(table.serviceId, table.createdAt)],
);
