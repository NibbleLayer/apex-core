import { z } from 'zod';

export const discoveryReviewStatusSchema = z.enum(['draft', 'in_review', 'published', 'rejected']);
export const discoveryIndexingStatusSchema = z.enum(['not_submitted', 'queued', 'indexed', 'failed']);

export const createDiscoverySchema = z.object({
  discoverable: z.boolean().default(false),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  description: z.string().max(2000).optional(),
  mimeType: z.string().max(100).optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  docsUrl: z.string().url().optional(),
  published: z.boolean().optional(),
  reviewStatus: discoveryReviewStatusSchema.optional(),
  indexingStatus: discoveryIndexingStatusSchema.optional(),
  indexingError: z.string().max(2000).nullable().optional(),
});

export const discoverySchema = z.object({
  id: z.string().min(1),
  routeId: z.string().min(1),
  discoverable: z.boolean(),
  category: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  description: z.string().nullable(),
  mimeType: z.string().nullable(),
  inputSchema: z.record(z.unknown()).nullable(),
  outputSchema: z.record(z.unknown()).nullable(),
  docsUrl: z.string().nullable(),
  published: z.boolean(),
  reviewStatus: discoveryReviewStatusSchema,
  indexingStatus: discoveryIndexingStatusSchema,
  indexingError: z.string().nullable(),
  updatedAt: z.coerce.date(),
});
