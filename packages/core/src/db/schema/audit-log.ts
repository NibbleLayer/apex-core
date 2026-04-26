import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: text('actor_id'), // api_key_id or sdk_token_id
    actorType: text('actor_type'), // 'api_key' | 'sdk_token' | 'system'
    action: text('action').notNull(), // 'create' | 'update' | 'delete' | 'read'
    resource: text('resource').notNull(), // 'service' | 'route' | 'environment' | etc.
    resourceId: text('resource_id'),
    payload: text('payload'), // JSON string of relevant data (no secrets)
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_log_org').on(table.organizationId),
    index('idx_audit_log_resource').on(table.resource, table.resourceId),
    index('idx_audit_log_created').on(table.createdAt),
  ],
);
