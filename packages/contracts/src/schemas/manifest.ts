import { z } from 'zod';
import { caip2Network } from './caip2.js';

const manifestEventsEndpointSchema = z.string().refine(
  (value) => {
    if (/^\/(?!\/)/.test(value)) {
      return true;
    }

    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'eventsEndpoint must be an absolute URL or root-relative path',
  },
);

const manifestRouteAcceptsSchema = z.object({
  scheme: z.enum(['exact']),
  price: z.string().min(1),
  network: caip2Network,
  payTo: z.string().min(1),
});

const manifestRouteExtensionsSchema = z.object({
  'payment-identifier': z.object({ required: z.boolean() }).optional(),
  bazaar: z
    .object({
      discoverable: z.boolean(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      inputSchema: z.record(z.unknown()).optional(),
      outputSchema: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const manifestRouteSchema = z.object({
  accepts: z.array(manifestRouteAcceptsSchema).min(1),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  extensions: manifestRouteExtensionsSchema.optional(),
});

const manifestWalletSchema = z.object({
  address: z.string().min(1),
  token: z.string().min(1),
  network: caip2Network,
});

export const apexManifestSchema = z.object({
  serviceId: z.string().min(1),
  environment: z.enum(['test', 'prod']),
  version: z.number().int().positive(),
  network: caip2Network,
  facilitatorUrl: z.string().url(),
  wallet: manifestWalletSchema,
  routes: z.record(manifestRouteSchema),
  eventsEndpoint: manifestEventsEndpointSchema,
  idempotencyEnabled: z.boolean(),
  refreshIntervalMs: z.number().int().positive(),
  checksum: z.string().min(1),
});
