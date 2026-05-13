import { z } from 'zod';
import { caip2Network } from './caip2.js';

export const createEnvironmentSchema = z.object({
  mode: z.enum(['test', 'prod']),
  network: caip2Network.optional(),
  networkProfileId: z.string().optional(),
  facilitatorUrl: z.string().url().optional(),
}).refine(
  (data) => data.network !== undefined || data.networkProfileId !== undefined,
  { message: 'Either network (CAIP-2) or networkProfileId is required' },
);

export const environmentSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  mode: z.enum(['test', 'prod']),
  network: caip2Network,
  facilitatorUrl: z.string().url(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
