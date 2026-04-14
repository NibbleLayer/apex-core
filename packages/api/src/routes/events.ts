import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { paymentEvents, services } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { ingestEvent } from '../services/event-service.js';

const router = new Hono();

router.use('*', authMiddleware);

// POST /events - Ingest payment event
router.post('/events', async (c) => {
  const db = await getDb();
  const orgId = c.get('organizationId');
  const rawPayload = await c.req.json();

  const result = await ingestEvent(db, rawPayload, orgId);
  return c.json(result.body, result.status as 200);
});

// GET /services/:id/events - List events (paginated, filterable)
router.get('/services/:id/events', async (c) => {
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

  const typeFilter = c.req.query('type');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50') || 50, 1), 100);
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0') || 0, 0);

  // Build where conditions
  const conditions = [eq(paymentEvents.serviceId, serviceId)];
  if (typeFilter) {
    conditions.push(eq(paymentEvents.type, typeFilter as any));
  }

  const events = await db
    .select()
    .from(paymentEvents)
    .where(and(...conditions))
    .orderBy(desc(paymentEvents.createdAt))
    .limit(limit)
    .offset(offset);

  // Count total
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(paymentEvents)
    .where(and(...conditions));

  return c.json({ events, total: count });
});

export const eventRoutes = router;
