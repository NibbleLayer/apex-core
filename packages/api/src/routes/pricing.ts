import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { priceRules, routes, services, environments } from '@nibblelayer/apex-persistence/db';
import { createPriceRuleSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';
import { generateManifest } from '../services/config-service.js';

const router = new Hono();

router.use('*', authMiddleware);

// POST /routes/:routeId/pricing - Create price rule
router.post('/routes/:routeId/pricing', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('routeId');
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
  const parsed = createPriceRuleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  const id = createId();

  const [created] = await db
    .insert(priceRules)
    .values({
      id,
      routeId,
      scheme: parsed.data.scheme,
      amount: parsed.data.amount,
      token: parsed.data.token,
      network: parsed.data.network,
      active: true,
    })
    .returning();

  // Trigger manifest regeneration for all environments of this route's service
  try {
    const envs = await db
      .select()
      .from(environments)
      .where(eq(environments.serviceId, existingRoute.serviceId));

    for (const env of envs) {
      await generateManifest(db, existingRoute.serviceId, env.mode as 'test' | 'prod');
    }
  } catch {
    // Manifest generation failure should not block price rule creation
  }

  return c.json(created, 201);
});

// GET /routes/:routeId/pricing - List price rules for a route
router.get('/routes/:routeId/pricing', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('routeId');
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

  const result = await db
    .select()
    .from(priceRules)
    .where(eq(priceRules.routeId, routeId));

  return c.json(result);
});

export const pricingRoutes = router;
