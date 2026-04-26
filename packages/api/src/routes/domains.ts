import dns from 'node:dns/promises';
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { createServiceDomainSchema } from '@nibblelayer/apex-contracts/schemas';
import { serviceDomains, services } from '@nibblelayer/apex-persistence/db';
import { getDb } from '../db/resolver.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  buildDnsProofRecord,
  generateDomainVerificationToken,
  normalizeDomain,
  verifyDnsTxtProof,
  type ResolveTxt,
} from '../services/domain-verification-service.js';
import { createId } from '../utils/id.js';

export function createDomainRoutes(resolveTxt: ResolveTxt = dns.resolveTxt) {
  const router = new Hono();

  router.get('/services/:serviceId/domains', authMiddleware, async (c) => {
    const db = await getDb();
    const orgId = c.get('organizationId');
    const serviceId = c.req.param('serviceId');

    const [svc] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
      .limit(1);

    if (!svc) return c.json({ error: 'Service not found' }, 404);

    const rows = await db
      .select()
      .from(serviceDomains)
      .where(and(eq(serviceDomains.serviceId, serviceId), eq(serviceDomains.organizationId, orgId)));

    return c.json(rows);
  });

  router.post('/services/:serviceId/domains', authMiddleware, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = createServiceDomainSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') }, 400);
    }

    let domain: string;
    try {
      domain = normalizeDomain(parsed.data.domain);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Domain is invalid' }, 400);
    }

    const db = await getDb();
    const orgId = c.get('organizationId');
    const serviceId = c.req.param('serviceId');
    const [svc] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
      .limit(1);

    if (!svc) return c.json({ error: 'Service not found' }, 404);

    const token = generateDomainVerificationToken();
    const proof = buildDnsProofRecord(domain, token);
    const now = new Date();

    try {
      const [created] = await db
        .insert(serviceDomains)
        .values({
          id: createId(),
          organizationId: orgId,
          serviceId,
          domain,
          verificationToken: token,
          verificationMethod: 'dns_txt',
          status: 'pending',
          dnsRecordName: proof.name,
          dnsRecordValue: proof.value,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return c.json(created, 201);
    } catch (err: any) {
      if (err.code === '23505') return c.json({ error: 'Domain already exists for this service' }, 409);
      throw err;
    }
  });

  router.post('/domains/:id/verify', authMiddleware, async (c) => {
    const db = await getDb();
    const orgId = c.get('organizationId');
    const id = c.req.param('id');

    const [domain] = await db
      .select()
      .from(serviceDomains)
      .where(and(eq(serviceDomains.id, id), eq(serviceDomains.organizationId, orgId)))
      .limit(1);

    if (!domain) return c.json({ error: 'Domain not found' }, 404);

    const result = await verifyDnsTxtProof({
      domain: domain.domain,
      token: domain.verificationToken,
      resolveTxt,
    });
    const now = new Date();

    const [updated] = await db
      .update(serviceDomains)
      .set({
        status: result.success ? 'verified' : 'failed',
        verifiedAt: result.success ? now : domain.verifiedAt,
        lastCheckedAt: now,
        failureReason: result.success ? null : (result.reason ?? 'DNS TXT verification failed'),
        updatedAt: now,
      })
      .where(eq(serviceDomains.id, id))
      .returning();

    return c.json({ ...updated, verification: result });
  });

  return router;
}

export const domainRoutes = createDomainRoutes();
