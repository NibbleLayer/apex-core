import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { environments, services } from '@nibblelayer/apex-persistence/db';
import { createEnvironmentSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';

const env = new Hono();

// All environment routes require authentication
env.use('*', authMiddleware);

// POST /services/:serviceId/environments - Create environment
env.post('/services/:serviceId/environments', async (c) => {
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
  const parsed = createEnvironmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  // Set default facilitator URL based on mode
  const facilitatorUrl = parsed.data.facilitatorUrl ?? (
    parsed.data.mode === 'test'
      ? 'https://x402.org/facilitator'
      : 'https://api.cdp.coinbase.com/platform/v2/x402'
  );

  const id = createId();
  const now = new Date();

  try {
    const [created] = await db
      .insert(environments)
      .values({
        id,
        serviceId,
        mode: parsed.data.mode,
        network: parsed.data.network,
        facilitatorUrl,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return c.json(created, 201);
  } catch (err: any) {
    // Unique constraint violation on (service_id, mode)
    const pgError = err?.cause ?? err;
    if (pgError?.code === '23505') {
      return c.json({ error: `Environment with mode '${parsed.data.mode}' already exists for this service` }, 409);
    }
    throw err;
  }
});

// GET /services/:serviceId/environments - List environments for a service
env.get('/services/:serviceId/environments', async (c) => {
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

  const envs = await db
    .select()
    .from(environments)
    .where(eq(environments.serviceId, serviceId));

  return c.json(envs);
});

// PATCH /environments/:id - Update environment
env.patch('/environments/:id', async (c) => {
  const db = await getDb();
  const envId = c.req.param('id');
  const orgId = c.get('organizationId');
  const body = await c.req.json();

  // Get the environment and verify ownership through service
  const [existing] = await db
    .select({
      id: environments.id,
      serviceId: environments.serviceId,
      facilitatorUrl: environments.facilitatorUrl,
    })
    .from(environments)
    .where(eq(environments.id, envId))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Environment not found' }, 404);
  }

  // Verify the service belongs to the authenticated org
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, existing.serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Environment not found' }, 404);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.facilitatorUrl !== undefined) updates.facilitatorUrl = body.facilitatorUrl;
  if (body.network !== undefined) {
    // Validate CAIP-2 format
    if (!/^[a-z][a-z0-9]*:[a-zA-Z0-9]+$/.test(body.network)) {
      return c.json({ error: 'Invalid CAIP-2 network identifier' }, 400);
    }
    updates.network = body.network;
  }

  const [updated] = await db
    .update(environments)
    .set(updates)
    .where(eq(environments.id, envId))
    .returning();

  return c.json(updated);
});

export const environmentRoutes = env;
