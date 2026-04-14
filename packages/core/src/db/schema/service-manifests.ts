import { pgTable, text, integer, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { services } from './services.js';
import { environments } from './environments.js';

export const serviceManifests = pgTable(
  'service_manifests',
  {
    id: text('id').primaryKey(),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    environmentId: text('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    /** Auto-incremented per (service_id, environment_id) */
    version: integer('version').notNull(),
    /** Full manifest config as JSON */
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    /** SHA-256 of payload */
    checksum: text('checksum').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('manifests_service_env_version_unique').on(
      table.serviceId,
      table.environmentId,
      table.version,
    ),
  ],
);
