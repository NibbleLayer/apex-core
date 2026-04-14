import { z } from 'zod';
import { caip2Network } from './caip2.js';

export const createWalletSchema = z.object({
  environmentId: z.string().min(1),
  address: z.string().min(1).max(255),
  token: z.string().min(1),
  network: caip2Network,
  label: z.string().max(255).optional(),
});

export const walletSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  environmentId: z.string().min(1),
  address: z.string().min(1),
  token: z.string().min(1),
  network: caip2Network,
  label: z.string().nullable(),
  active: z.boolean(),
});
