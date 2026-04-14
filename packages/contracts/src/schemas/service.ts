import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
});

export const serviceSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
