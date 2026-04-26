import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { services } from './services.js';

export const serviceDomains = pgTable(
  'service_domains',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    verificationToken: text('verification_token').notNull(),
    verificationMethod: text('verification_method', { enum: ['dns_txt'] })
      .notNull()
      .default('dns_txt'),
    status: text('status', { enum: ['pending', 'verified', 'failed'] })
      .notNull()
      .default('pending'),
    dnsRecordName: text('dns_record_name').notNull(),
    dnsRecordValue: text('dns_record_value').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('service_domains_service_domain_unique').on(table.serviceId, table.domain)],
);
