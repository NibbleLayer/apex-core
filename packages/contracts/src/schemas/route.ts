import { z } from 'zod';

export const createRouteSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1).max(500).startsWith('/'),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional().default(true),
});

export const routeSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  description: z.string().nullable(),
  enabled: z.boolean(),
  source: z.enum(['dashboard', 'sdk']).default('dashboard'),
  publicationStatus: z.enum(['draft', 'published']).default('published'),
  lastSeenAt: z.date().nullable().optional(),
  updatedAt: z.date().optional(),
});
