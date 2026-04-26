import { pgTable, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { routes } from './routes.js';

export const discoveryMetadata = pgTable('discovery_metadata', {
  id: text('id').primaryKey(),
  routeId: text('route_id')
    .notNull()
    .references(() => routes.id, { onDelete: 'cascade' })
    .unique(),
  discoverable: boolean('discoverable').notNull().default(false),
  category: text('category'),
  /** Array of string tags */
  tags: jsonb('tags').$type<string[]>(),
  description: text('description'),
  mimeType: text('mime_type'),
  inputSchema: jsonb('input_schema').$type<Record<string, unknown>>(),
  outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(),
  docsUrl: text('docs_url'),
  published: boolean('published').notNull().default(false),
  reviewStatus: text('review_status', { enum: ['draft', 'in_review', 'published', 'rejected'] })
    .notNull()
    .default('draft'),
  indexingStatus: text('indexing_status', { enum: ['not_submitted', 'queued', 'indexed', 'failed'] })
    .notNull()
    .default('not_submitted'),
  indexingError: text('indexing_error'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
