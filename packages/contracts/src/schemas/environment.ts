import { z } from 'zod';
import { caip2Network } from './caip2.js';

export const createEnvironmentSchema = z.object({
  mode: z.enum(['test', 'prod']),
  network: caip2Network,
  facilitatorUrl: z.string().url().optional(),
});

export const environmentSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  mode: z.enum(['test', 'prod']),
  network: caip2Network,
  facilitatorUrl: z.string().url(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
