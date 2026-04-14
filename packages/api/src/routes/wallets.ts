import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { walletDestinations, environments, services } from '@nibblelayer/apex-persistence/db';
import { createWalletSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';

const wallet = new Hono();

// All wallet routes require authentication
wallet.use('*', authMiddleware);

// POST /services/:serviceId/wallets - Create wallet destination
wallet.post('/services/:serviceId/wallets', async (c) => {
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
  const parsed = createWalletSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  // Verify environment exists and belongs to the service
  const [env] = await db
    .select()
    .from(environments)
    .where(and(
      eq(environments.id, parsed.data.environmentId),
      eq(environments.serviceId, serviceId),
    ))
    .limit(1);

  if (!env) {
    return c.json({ error: 'Environment not found' }, 404);
  }

  // Verify network matches
  if (env.network !== parsed.data.network) {
    return c.json({ error: 'Wallet network must match environment network' }, 400);
  }

  const id = createId();

  const [created] = await db
    .insert(walletDestinations)
    .values({
      id,
      serviceId,
      environmentId: parsed.data.environmentId,
      address: parsed.data.address,
      token: parsed.data.token,
      network: parsed.data.network,
      label: parsed.data.label ?? null,
      active: true,
    })
    .returning();

  return c.json(created, 201);
});

// GET /services/:serviceId/wallets - List wallet destinations
wallet.get('/services/:serviceId/wallets', async (c) => {
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

  const envFilter = c.req.query('environment_id');

  let result;
  if (envFilter) {
    result = await db
      .select()
      .from(walletDestinations)
      .where(
        and(
          eq(walletDestinations.serviceId, serviceId),
          eq(walletDestinations.environmentId, envFilter),
        ),
      );
  } else {
    result = await db
      .select()
      .from(walletDestinations)
      .where(eq(walletDestinations.serviceId, serviceId));
  }

  return c.json(result);
});

export const walletRoutes = wallet;
