import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { routes, services } from '@nibblelayer/apex-persistence/db';
import { createRouteSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';

const router = new Hono();

// All route routes require authentication
router.use('*', authMiddleware);

// POST /services/:serviceId/routes - Create route
router.post('/services/:serviceId/routes', async (c) => {
  const db = await getDb();
  const serviceId = c.req.param('serviceId');
  const orgId = c.get('organizationId');

  // Verify service belongs to the authenticated organization
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Service not found' }, 404);
  }

  const body = await c.req.json();
  const parsed = createRouteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  const id = createId();

  try {
    const [created] = await db
      .insert(routes)
      .values({
        id,
        serviceId,
        method: parsed.data.method,
        path: parsed.data.path,
        description: parsed.data.description ?? null,
        enabled: parsed.data.enabled ?? true,
        source: 'dashboard',
        publicationStatus: 'published',
        updatedAt: new Date(),
      })
      .returning();

    return c.json(created, 201);
  } catch (err: any) {
    // Unique constraint violation on (service_id, method, path)
    const pgError = err?.cause ?? err;
    if (pgError?.code === '23505') {
      return c.json(
        { error: `Route ${parsed.data.method} ${parsed.data.path} already exists for this service` },
        409,
      );
    }
    throw err;
  }
});

// GET /services/:serviceId/routes - List routes for a service
router.get('/services/:serviceId/routes', async (c) => {
  const db = await getDb();
  const serviceId = c.req.param('serviceId');
  const orgId = c.get('organizationId');

  // Verify service belongs to the authenticated organization
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Service not found' }, 404);
  }

  const result = await db
    .select()
    .from(routes)
    .where(eq(routes.serviceId, serviceId));

  return c.json(result);
});

// PATCH /routes/:id - Update route enabled/description/publication status
router.patch('/routes/:id', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('id');
  const orgId = c.get('organizationId');
  const body = await c.req.json();

  // Get the route and verify ownership through service
  const [existing] = await db
    .select({
      id: routes.id,
      serviceId: routes.serviceId,
    })
    .from(routes)
    .where(eq(routes.id, routeId))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Route not found' }, 404);
  }

  // Verify the service belongs to the authenticated org
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, existing.serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const updates: Record<string, any> = {};
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.description !== undefined) updates.description = body.description;
  if (body.publicationStatus !== undefined) {
    if (body.publicationStatus !== 'draft' && body.publicationStatus !== 'published') {
      return c.json({ error: 'publicationStatus must be "draft" or "published"' }, 400);
    }
    updates.publicationStatus = body.publicationStatus;
    if (body.publicationStatus === 'published' && body.enabled === undefined) {
      updates.enabled = true;
    }
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No supported route fields provided' }, 400);
  }
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(routes)
    .set(updates)
    .where(eq(routes.id, routeId))
    .returning();

  return c.json(updated);
});

export const routeRoutes = router;
