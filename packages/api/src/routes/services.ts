import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { services, environments, routes } from '@nibblelayer/apex-persistence/db';
import { createServiceSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';

const service = new Hono();

// All service routes require authentication
service.use('*', authMiddleware);

// GET / - List all services for the authenticated organization
service.get('/', async (c) => {
  const db = await getDb();
  const orgId = c.get('organizationId');

  const orgServices = await db
    .select()
    .from(services)
    .where(eq(services.organizationId, orgId));

  return c.json(orgServices);
});

// POST / - Create a service under the authenticated organization
service.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createServiceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  const db = await getDb();
  const orgId = c.get('organizationId');
  const id = createId();
  const now = new Date();

  try {
    const [created] = await db
      .insert(services)
      .values({
        id,
        organizationId: orgId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(created, 201);
  } catch (err: any) {
    // Handle unique constraint violation (duplicate slug per org)
    if (err.code === '23505') {
      return c.json({ error: 'Service slug already exists for this organization' }, 409);
    }
    throw err;
  }
});

// GET /:id - Get service with environment and route count
service.get('/:id', async (c) => {
  const db = await getDb();
  const serviceId = c.req.param('id');
  const orgId = c.get('organizationId');

  const [found] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!found) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Get environments for this service
  const envs = await db
    .select()
    .from(environments)
    .where(eq(environments.serviceId, serviceId));

  // Get route count
  const routeRows = await db
    .select({ id: routes.id })
    .from(routes)
    .where(eq(routes.serviceId, serviceId));

  return c.json({
    ...found,
    environments: envs,
    routeCount: routeRows.length,
  });
});

// PATCH /:id - Update service name/description
service.patch('/:id', async (c) => {
  const db = await getDb();
  const serviceId = c.req.param('id');
  const orgId = c.get('organizationId');
  const body = await c.req.json();

  // Verify ownership
  const [existing] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Not found' }, 404);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  const [updated] = await db
    .update(services)
    .set(updates)
    .where(eq(services.id, serviceId))
    .returning();

  return c.json(updated);
});

export const serviceRoutes = service;
