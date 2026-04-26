import { z } from 'zod';

export const serviceDomainSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  serviceId: z.string().min(1),
  domain: z.string().min(1),
  verificationToken: z.string().min(1),
  verificationMethod: z.literal('dns_txt'),
  status: z.enum(['pending', 'verified', 'failed']),
  dnsRecordName: z.string().min(1),
  dnsRecordValue: z.string().min(1),
  verifiedAt: z.string().datetime().nullable().optional(),
  lastCheckedAt: z.string().datetime().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const createServiceDomainSchema = z.object({
  domain: z.string().min(1).max(253),
});

export const serviceDomainVerificationResultSchema = z.object({
  success: z.boolean(),
  reason: z.string().optional(),
  dnsRecordName: z.string().min(1),
  dnsRecordValue: z.string().min(1),
});
