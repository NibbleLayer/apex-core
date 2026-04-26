import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { services } from './services.js';

export const sdkTokens = pgTable('sdk_tokens', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  environmentMode: text('environment_mode', {
    enum: ['test', 'prod'],
  }).notNull(),
  /** SHA-256 hash of the raw SDK token — the raw token is shown once and never stored. */
  keyHash: text('key_hash').notNull().unique(),
  label: text('label'),
  scopes: jsonb('scopes').notNull().$type<string[]>(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
