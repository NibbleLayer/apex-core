import crypto from 'node:crypto';
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { webhookEndpoints, services } from '@nibblelayer/apex-persistence/db';
import { createWebhookSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';

const router = new Hono();

router.use('*', authMiddleware);

// POST /services/:id/webhooks - Create webhook endpoint
router.post('/services/:id/webhooks', async (c) => {
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

  const body = await c.req.json();
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  // Generate secret
  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

  const id = createId();
  const now = new Date();

  const [created] = await db
    .insert(webhookEndpoints)
    .values({
      id,
      serviceId,
      url: parsed.data.url,
      secret,
      enabled: parsed.data.enabled,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Return with secret (only time it's exposed)
  return c.json(created, 201);
});

// GET /services/:id/webhooks - List webhook endpoints (secrets excluded)
router.get('/services/:id/webhooks', async (c) => {
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

  const result = await db
    .select({
      id: webhookEndpoints.id,
      serviceId: webhookEndpoints.serviceId,
      url: webhookEndpoints.url,
      enabled: webhookEndpoints.enabled,
      createdAt: webhookEndpoints.createdAt,
      updatedAt: webhookEndpoints.updatedAt,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.serviceId, serviceId));

  return c.json(result);
});

// PATCH /webhooks/:id - Update webhook
router.patch('/webhooks/:id', async (c) => {
  const db = await getDb();
  const webhookId = c.req.param('id');
  const orgId = c.get('organizationId');
  const body = await c.req.json();

  // Get webhook and verify ownership
  const [existing] = await db
    .select({
      id: webhookEndpoints.id,
      serviceId: webhookEndpoints.serviceId,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, webhookId))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  // Verify the service belongs to the authenticated org
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, existing.serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.url !== undefined) updates.url = body.url;
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  const [updated] = await db
    .update(webhookEndpoints)
    .set(updates)
    .where(eq(webhookEndpoints.id, webhookId))
    .returning();

  // Exclude secret from response
  const { secret: _, ...response } = updated;
  return c.json(response);
});

export const webhookRoutes = router;
