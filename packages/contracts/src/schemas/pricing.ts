import { z } from 'zod';
import { caip2Network } from './caip2.js';

export const createPriceRuleSchema = z.object({
  scheme: z.enum(['exact']).default('exact'),
  amount: z.string().min(1),
  token: z.string().min(1),
  network: caip2Network,
});

export const priceRuleSchema = z.object({
  id: z.string().min(1),
  routeId: z.string().min(1),
  scheme: z.enum(['exact']),
  amount: z.string().min(1),
  token: z.string().min(1),
  network: caip2Network,
  active: z.boolean(),
});
