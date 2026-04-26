import { z } from 'zod';
import { caip2Network } from './caip2.js';

export const paymentEventTypeSchema = z.enum([
  'payment.required',
  'payment.verified',
  'payment.settled',
  'payment.failed',
  'payment.replay',
]);

export const paymentEventPayloadSchema = z.object({
  serviceId: z.string().min(1),
  routeId: z.string().min(1),
  type: paymentEventTypeSchema,
  requestId: z.string().min(1),
  paymentIdentifier: z.string().min(1),
  buyerAddress: z.string().optional(),
  amount: z.string().optional(),
  token: z.string().optional(),
  network: caip2Network.optional(),
  settlementReference: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const paymentEventSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  routeId: z.string().min(1),
  type: paymentEventTypeSchema,
  requestId: z.string().min(1),
  paymentIdentifier: z.string().nullable(),
  buyerAddress: z.string().nullable(),
  payload: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
});
