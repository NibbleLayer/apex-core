import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  /** SHA-256 hash of the raw API key — the raw key is never stored */
  keyHash: text('key_hash').notNull().unique(),
  /** First 8 characters of the raw key for indexed prefix lookups */
  keyPrefix: text('key_prefix').notNull(),
  label: text('label'),
  role: varchar('role', { length: 20 }).notNull().default('admin'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
