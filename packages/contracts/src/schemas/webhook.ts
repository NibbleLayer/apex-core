import { z } from 'zod';

export const createWebhookSchema = z.object({
  url: z.string().url(),
  enabled: z.boolean().optional().default(true),
});
