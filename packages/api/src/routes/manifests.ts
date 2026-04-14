import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { services, serviceManifests, environments } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { generateManifest } from '../services/config-service.js';

const router = new Hono();

router.use('*', authMiddleware);

// GET /services/:id/manifest - Get latest manifest for a service
router.get('/services/:id/manifest', async (c) => {
  const db = await getDb();
  const serviceId = c.req.param('id');
  const orgId = c.get('organizationId');
  const env = c.req.query('env') as 'test' | 'prod' | undefined;

  if (!env || (env !== 'test' && env !== 'prod')) {
    return c.json({ error: 'Query parameter "env" must be "test" or "prod"' }, 400);
  }

  // Verify service belongs to the authenticated org
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Service not found' }, 404);
  }

  // Get environment for this mode
  const [environment] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.serviceId, serviceId), eq(environments.mode, env)))
    .limit(1);

  if (!environment) {
    return c.json({ error: `No ${env} environment configured for this service` }, 404);
  }

  // Try to get latest existing manifest
  const [existing] = await db
    .select()
    .from(serviceManifests)
    .where(
      and(
        eq(serviceManifests.serviceId, serviceId),
        eq(serviceManifests.environmentId, environment.id),
      ),
    )
    .orderBy(desc(serviceManifests.version))
    .limit(1);

  if (existing) {
    c.header('x-apex-skip-serialization', '1');
    return c.json(existing.payload);
  }

  // No manifest exists — generate one on-demand
  try {
    const { manifest } = await generateManifest(db, serviceId, env);
    c.header('x-apex-skip-serialization', '1');
    return c.json(manifest);
  } catch (err: any) {
    return c.json({ error: `Cannot generate manifest: ${err.message}` }, 404);
  }
});

export const manifestRoutes = router;
