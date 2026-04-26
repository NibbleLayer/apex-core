import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { discoveryMetadata, routes, services, environments } from '@nibblelayer/apex-persistence/db';
import { createDiscoverySchema } from '@nibblelayer/apex-contracts/schemas';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';
import { generateManifest } from '../services/config-service.js';
import { buildDiscoveryPreview, validateDiscoveryQuality } from '../services/discovery-quality.js';

const router = new Hono();

router.use('*', authMiddleware);

type ReviewStatus = 'draft' | 'in_review' | 'published' | 'rejected';
type IndexingStatus = 'not_submitted' | 'queued' | 'indexed' | 'failed';

async function requireRouteForOrg(db: Awaited<ReturnType<typeof getDb>>, routeId: string, orgId: string) {
  const [existingRoute] = await db
    .select({
      id: routes.id,
      serviceId: routes.serviceId,
      method: routes.method,
      path: routes.path,
      description: routes.description,
    })
    .from(routes)
    .where(eq(routes.id, routeId))
    .limit(1);

  if (!existingRoute) return null;

  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, existingRoute.serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  return svc ? existingRoute : null;
}

function resolveReviewStatus(input: { reviewStatus?: ReviewStatus; published?: boolean }, existing?: { reviewStatus?: ReviewStatus; published?: boolean }): ReviewStatus {
  if (input.reviewStatus) return input.reviewStatus;
  if (input.published === true) return 'published';
  if (input.published === false) return existing?.reviewStatus === 'published' ? 'draft' : (existing?.reviewStatus ?? 'draft');
  return existing?.reviewStatus ?? (existing?.published ? 'published' : 'draft');
}

function buildPersistenceData(parsedData: ReturnType<typeof createDiscoverySchema.parse>, existing?: typeof discoveryMetadata.$inferSelect) {
  const reviewStatus = resolveReviewStatus(parsedData, existing) as ReviewStatus;
  const publishing = reviewStatus === 'published';
  const indexingStatus = (parsedData.indexingStatus ?? (publishing && existing?.reviewStatus !== 'published' ? 'queued' : existing?.indexingStatus ?? 'not_submitted')) as IndexingStatus;
  const data = {
    discoverable: parsedData.discoverable,
    category: parsedData.category ?? existing?.category ?? null,
    tags: parsedData.tags ?? existing?.tags ?? null,
    description: parsedData.description ?? existing?.description ?? null,
    mimeType: parsedData.mimeType ?? existing?.mimeType ?? null,
    inputSchema: parsedData.inputSchema ?? existing?.inputSchema ?? null,
    outputSchema: parsedData.outputSchema ?? existing?.outputSchema ?? null,
    docsUrl: parsedData.docsUrl ?? existing?.docsUrl ?? null,
    reviewStatus,
    published: publishing,
    indexingStatus,
    indexingError: parsedData.indexingError ?? existing?.indexingError ?? null,
    updatedAt: new Date(),
  };

  if (publishing && !parsedData.indexingStatus) {
    data.indexingStatus = 'queued';
  }

  return data;
}

async function regenerateManifests(db: Awaited<ReturnType<typeof getDb>>, serviceId: string) {
  try {
    const envs = await db.select().from(environments).where(eq(environments.serviceId, serviceId));

    for (const env of envs) {
      await generateManifest(db, serviceId, env.mode as 'test' | 'prod');
    }
  } catch {
    // Don't block discovery writes on manifest failure
  }
}

// POST /routes/:id/discovery - Create or update discovery metadata
router.post('/routes/:id/discovery', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('id');
  const orgId = c.get('organizationId');

  const existingRoute = await requireRouteForOrg(db, routeId, orgId);
  if (!existingRoute) {
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
    const updateData = buildPersistenceData(parsed.data, existing);
    if (updateData.reviewStatus === 'published') {
      const qualityChecks = validateDiscoveryQuality(updateData);
      const qualityErrors = qualityChecks.filter((check) => check.level === 'error');
      if (qualityErrors.length > 0) {
        return c.json({ error: 'Discovery metadata is not ready to publish', qualityChecks }, 400);
      }
    }

    const [updated] = await db
      .update(discoveryMetadata)
      .set(updateData)
      .where(eq(discoveryMetadata.id, existing.id))
      .returning();

    await regenerateManifests(db, existingRoute.serviceId);

    return c.json(updated, 200);
  }

  // Create new
  const id = createId();
  const createData = buildPersistenceData(parsed.data);
  if (createData.reviewStatus === 'published') {
    const qualityChecks = validateDiscoveryQuality(createData);
    const qualityErrors = qualityChecks.filter((check) => check.level === 'error');
    if (qualityErrors.length > 0) {
      return c.json({ error: 'Discovery metadata is not ready to publish', qualityChecks }, 400);
    }
  }

  const [created] = await db
    .insert(discoveryMetadata)
    .values({
      id,
      routeId,
      ...createData,
    })
    .returning();

  await regenerateManifests(db, existingRoute.serviceId);

  return c.json(created, 201);
});

// GET /routes/:id/discovery/preview - Preview Bazaar listing and quality checks
router.get('/routes/:id/discovery/preview', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('id');
  const orgId = c.get('organizationId');

  const existingRoute = await requireRouteForOrg(db, routeId, orgId);
  if (!existingRoute) {
    return c.json({ error: 'Route not found' }, 404);
  }

  const [metadata] = await db
    .select()
    .from(discoveryMetadata)
    .where(eq(discoveryMetadata.routeId, routeId))
    .limit(1);

  if (!metadata) {
    return c.json({ error: 'No discovery metadata found for this route' }, 404);
  }

  const qualityChecks = validateDiscoveryQuality(metadata);
  const preview = buildDiscoveryPreview({ route: existingRoute, metadata });

  return c.json({ preview, qualityChecks });
});

// GET /routes/:id/discovery - Get discovery metadata
router.get('/routes/:id/discovery', async (c) => {
  const db = await getDb();
  const routeId = c.req.param('id');
  const orgId = c.get('organizationId');

  const existingRoute = await requireRouteForOrg(db, routeId, orgId);
  if (!existingRoute) {
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
