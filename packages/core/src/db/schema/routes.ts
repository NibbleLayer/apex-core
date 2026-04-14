import { pgTable, text, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
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
  },
  (table) => [
    uniqueIndex('routes_service_method_path_unique').on(table.serviceId, table.method, table.path),
  ],
);
