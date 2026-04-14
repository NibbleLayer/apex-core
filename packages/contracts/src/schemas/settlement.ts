import { z } from 'zod';
import { caip2Network } from './caip2.js';

export const settlementSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  routeId: z.string().min(1),
  paymentEventId: z.string().min(1),
  amount: z.string().min(1),
  token: z.string().min(1),
  network: caip2Network,
  settlementReference: z.string().nullable(),
  status: z.enum(['pending', 'confirmed', 'failed']),
  createdAt: z.date(),
});
