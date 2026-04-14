import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

export const organizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64),
  createdAt: z.date(),
  updatedAt: z.date(),
});
