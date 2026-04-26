import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { settlements, services } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { assertSettlementTransition, type SettlementStatus } from '../services/settlement-service.js';

const router = new Hono();

router.use('*', authMiddleware);

// GET /services/:id/settlements - List settlements (paginated, filterable by status)
router.get('/services/:id/settlements', async (c) => {
  const db = await getDb();
  const serviceId = c.req.param('id');
  const orgId = c.get('organizationId');

  // Verify service belongs to the authenticated org
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Service not found' }, 404);
  }

  const statusFilter = c.req.query('status');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50') || 50, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0') || 0, 0);

  // Build where conditions
  const conditions = [eq(settlements.serviceId, serviceId)];
  if (statusFilter) {
    conditions.push(eq(settlements.status, statusFilter as any));
  }

  const result = await db
    .select()
    .from(settlements)
    .where(and(...conditions))
    .orderBy(desc(settlements.createdAt))
    .limit(limit)
    .offset(offset);

  // Count total
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(settlements)
    .where(and(...conditions));

  return c.json({ settlements: result, total: count });
});

// PATCH /settlements/:id/status - transition settlement status explicitly.
router.patch('/settlements/:id/status', async (c) => {
  const db = await getDb();
  const settlementId = c.req.param('id');
  const orgId = c.get('organizationId');
  const body = await c.req.json();

  if (!['pending', 'confirmed', 'failed'].includes(body.status)) {
    return c.json({ error: 'status must be pending, confirmed, or failed' }, 400);
  }

  const [existing] = await db
    .select({
      id: settlements.id,
      serviceId: settlements.serviceId,
      status: settlements.status,
      serviceOrgId: services.organizationId,
    })
    .from(settlements)
    .innerJoin(services, eq(settlements.serviceId, services.id))
    .where(eq(settlements.id, settlementId))
    .limit(1);

  if (!existing || existing.serviceOrgId !== orgId) {
    return c.json({ error: 'Settlement not found' }, 404);
  }

  try {
    assertSettlementTransition(existing.status as SettlementStatus, body.status as SettlementStatus);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid settlement transition' }, 409);
  }

  const updates: Record<string, unknown> = {
    status: body.status,
    updatedAt: new Date(),
  };
  if (body.settlementReference !== undefined) {
    updates.settlementReference = body.settlementReference || null;
  }

  const [updated] = await db
    .update(settlements)
    .set(updates)
    .where(eq(settlements.id, settlementId))
    .returning();

  return c.json(updated);
});

export const settlementRoutes = router;
