import { pgTable, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const usageCounters = pgTable(
  'usage_counters',
  {
    id: varchar('id').primaryKey(),
    organizationId: varchar('organization_id').notNull(),
    period: varchar('period', { length: 7 }).notNull(), // 'YYYY-MM' format
    eventType: varchar('event_type', { length: 50 }).notNull(), // 'payment_events' | 'settlements' | 'api_calls'
    count: integer('count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_usage_counters_org_period_type').on(table.organizationId, table.period, table.eventType),
  ],
);
