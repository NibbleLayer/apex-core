import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { discoveryMetadata, routes, services, environments } from '@nibblelayer/apex-persistence/db';
import { createDiscoverySchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';
import { generateManifest } from '../services/config-service.js';

const router = new Hono();

router.use('*', authMiddleware);

// POST /routes/:id/discovery - Create or update discovery metadata
router.post('/routes/:id/discovery', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('id');
  const orgId = c.get('organizationId');

  // Verify route exists and belongs to authenticated org
  const [existingRoute] = await db
    .select({
      id: routes.id,
      serviceId: routes.serviceId,
    })
    .from(routes)
    .where(eq(routes.id, routeId))
    .limit(1);

  if (!existingRoute) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, existingRoute.serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const body = await c.req.json();
  const parsed = createDiscoverySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  // Check if discovery metadata already exists for this route
  const [existing] = await db
    .select()
    .from(discoveryMetadata)
    .where(eq(discoveryMetadata.routeId, routeId))
    .limit(1);

  if (existing) {
    // Update — also handle 'published' which is not in the schema but may be in the body
    const updateData: Record<string, any> = {
      discoverable: parsed.data.discoverable,
      category: parsed.data.category ?? null,
      tags: parsed.data.tags ?? null,
      description: parsed.data.description ?? null,
      mimeType: parsed.data.mimeType ?? null,
      inputSchema: parsed.data.inputSchema ?? null,
      outputSchema: parsed.data.outputSchema ?? null,
      docsUrl: parsed.data.docsUrl ?? null,
    };
    if (body.published !== undefined) {
      if (typeof body.published !== 'boolean') {
        return c.json({ error: 'published must be a boolean' }, 400);
      }
      updateData.published = body.published;
    }

    const [updated] = await db
      .update(discoveryMetadata)
      .set(updateData)
      .where(eq(discoveryMetadata.id, existing.id))
      .returning();

    // Trigger manifest regeneration
    try {
      const envs = await db
        .select()
        .from(environments)
        .where(eq(environments.serviceId, existingRoute.serviceId));

      for (const env of envs) {
        await generateManifest(db, existingRoute.serviceId, env.mode as 'test' | 'prod');
      }
    } catch {
      // Don't block discovery update on manifest failure
    }

    return c.json(updated, 200);
  }

  // Create new
  const id = createId();
  const [created] = await db
    .insert(discoveryMetadata)
    .values({
      id,
      routeId,
      discoverable: parsed.data.discoverable,
      category: parsed.data.category ?? null,
      tags: parsed.data.tags ?? null,
      description: parsed.data.description ?? null,
      mimeType: parsed.data.mimeType ?? null,
      inputSchema: parsed.data.inputSchema ?? null,
      outputSchema: parsed.data.outputSchema ?? null,
      docsUrl: parsed.data.docsUrl ?? null,
      published: false,
    })
    .returning();

  // Trigger manifest regeneration
  try {
    const envs = await db
      .select()
      .from(environments)
      .where(eq(environments.serviceId, existingRoute.serviceId));

    for (const env of envs) {
      await generateManifest(db, existingRoute.serviceId, env.mode as 'test' | 'prod');
    }
  } catch {
    // Don't block discovery creation on manifest failure
  }

  return c.json(created, 201);
});

// GET /routes/:id/discovery - Get discovery metadata
router.get('/routes/:id/discovery', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('id');
  const orgId = c.get('organizationId');

  // Verify route exists and belongs to authenticated org
  const [existingRoute] = await db
    .select({
      id: routes.id,
      serviceId: routes.serviceId,
    })
    .from(routes)
    .where(eq(routes.id, routeId))
    .limit(1);

  if (!existingRoute) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, existingRoute.serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const [result] = await db
    .select()
    .from(discoveryMetadata)
    .where(eq(discoveryMetadata.routeId, routeId))
    .limit(1);

  if (!result) {
    return c.json({ error: 'No discovery metadata found for this route' }, 404);
  }

  return c.json(result);
});

export const discoveryRoutes = router;
