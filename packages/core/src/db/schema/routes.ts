import { pgTable, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { services } from './services.js';

export const routes = pgTable(
  'routes',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    method: text('method', {
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }).notNull(),
    path: text('path').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    source: text('source', { enum: ['dashboard', 'sdk'] }).notNull().default('dashboard'),
    publicationStatus: text('publication_status', { enum: ['draft', 'published'] }).notNull().default('published'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('routes_service_method_path_unique').on(table.serviceId, table.method, table.path),
  ],
);
