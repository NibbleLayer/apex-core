import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { settlements, services } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';

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

export const settlementRoutes = router;
