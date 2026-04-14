import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { organizations } from '@nibblelayer/apex-persistence/db';
import { createOrganizationSchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';

const org = new Hono();
const UNAUTHENTICATED_BOOTSTRAP_TOGGLE = 'ALLOW_UNAUTHENTICATED_ORGANIZATION_BOOTSTRAP';

function isUnauthenticatedBootstrapEnabled(): boolean {
  return process.env[UNAUTHENTICATED_BOOTSTRAP_TOGGLE]?.trim().toLowerCase() === 'true';
}

async function organizationCreationGuard(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    if (isUnauthenticatedBootstrapEnabled()) {
      await next();
      return;
    }

    return c.json(
      { error: 'Authentication required unless unauthenticated bootstrap is explicitly enabled' },
      401,
    );
  }

  return authMiddleware(c, next);
}

// POST / - Create organization
org.post('/', organizationCreationGuard, async (c) => {
  const body = await c.req.json();
  const parsed = createOrganizationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, 400);
  }

  const db = await getDb();
  const id = createId();
  const now = new Date();
  const [created] = await db
    .insert(organizations)
    .values({
      id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json(created, 201);
});

// GET /:id - Get organization by ID
org.get('/:id', authMiddleware, async (c) => {
  const db = await getDb();
  const orgId = c.req.param('id');
  const orgIdFromKey = c.get('organizationId');

  // Can only access own organization
  if (orgId !== orgIdFromKey) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const [found] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!found) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json(found);
});

export const organizationRoutes = org;
