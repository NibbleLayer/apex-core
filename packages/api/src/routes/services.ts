import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { services, environments, routes, sdkTokens } from '@nibblelayer/apex-persistence/db';
import { createServiceSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';
import { generateSdkToken } from '../services/sdk-token-service.js';

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

// POST /:serviceId/sdk-tokens - Create a scoped SDK token for manifest/event SDK use
service.post('/:serviceId/sdk-tokens', async (c) => {
  const db = await getDb();
  const orgId = c.get('organizationId');
  const serviceId = c.req.param('serviceId');
  const body = await c.req.json().catch(() => ({}));

  const [found] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!found) {
    return c.json({ error: 'Service not found' }, 404);
  }

  const environment = body.environment;
  if (environment !== 'test' && environment !== 'prod') {
    return c.json({ error: 'Body field "environment" must be "test" or "prod"' }, 400);
  }

  const scopes = body.scopes ?? ['manifest:read', 'events:write'];
  if (
    !Array.isArray(scopes) ||
    scopes.length === 0 ||
    scopes.some((scope) => typeof scope !== 'string' || scope.trim().length === 0)
  ) {
    return c.json({ error: 'Body field "scopes" must be a non-empty string array' }, 400);
  }

  if (!scopes.includes('manifest:read')) {
    return c.json({ error: 'SDK token scopes must include "manifest:read"' }, 400);
  }

  const expiresAt = body.expiresAt === undefined || body.expiresAt === null ? null : new Date(body.expiresAt);
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return c.json({ error: 'Body field "expiresAt" must be a valid ISO datetime' }, 400);
  }

  const { rawToken, keyHash } = generateSdkToken();
  const id = createId();
  const [created] = await db
    .insert(sdkTokens)
    .values({
      id,
      organizationId: orgId,
      serviceId,
      environmentMode: environment,
      keyHash,
      label: typeof body.label === 'string' ? body.label : null,
      scopes,
      expiresAt,
    })
    .returning({
      id: sdkTokens.id,
      serviceId: sdkTokens.serviceId,
      environmentMode: sdkTokens.environmentMode,
      scopes: sdkTokens.scopes,
    });

  return c.json(
    {
      id: created.id,
      token: rawToken,
      serviceId: created.serviceId,
      environment: created.environmentMode,
      scopes: created.scopes,
    },
    201,
  );
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
