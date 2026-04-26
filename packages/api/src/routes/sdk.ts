import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createRouteSchema } from '@nibblelayer/apex-contracts/schemas';
import { routes } from '@nibblelayer/apex-persistence/db';
import { createSdkAuthMiddleware } from '../middleware/sdk-auth.js';
import { getDb } from '../db/resolver.js';
import { createId } from '../utils/id.js';

const MAX_REGISTERED_ROUTES = 50;

const sdkRouteCandidateSchema = createRouteSchema.pick({ method: true, path: true, description: true });
const registerRoutesSchema = z.object({
  routes: z.array(sdkRouteCandidateSchema).min(1).max(MAX_REGISTERED_ROUTES),
});

const router = new Hono();

router.post('/sdk/register', createSdkAuthMiddleware('routes:register'), async (c) => {
  const db = await getDb();
  const body = await c.req.json();
  const parsed = registerRoutesSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') }, 400);
  }

  const serviceId = c.get('serviceId');
  const now = new Date();
  let created = 0;
  let seen = 0;
  let skipped = 0;
  const results: Array<{
    id?: string;
    method: string;
    path: string;
    status: 'created' | 'seen' | 'skipped';
  }> = [];

  for (const candidate of parsed.data.routes) {
    const [existing] = await db
      .select()
      .from(routes)
      .where(
        and(
          eq(routes.serviceId, serviceId),
          eq(routes.method, candidate.method),
          eq(routes.path, candidate.path),
        ),
      )
      .limit(1);

    if (!existing) {
      const [inserted] = await db
        .insert(routes)
        .values({
          id: createId(),
          serviceId,
          method: candidate.method,
          path: candidate.path,
          description: candidate.description ?? null,
          enabled: false,
          source: 'sdk',
          publicationStatus: 'draft',
          lastSeenAt: now,
          updatedAt: now,
        })
        .returning({ id: routes.id });

      created += 1;
      results.push({ id: inserted.id, method: candidate.method, path: candidate.path, status: 'created' });
      continue;
    }

    if (existing.source === 'sdk' && existing.publicationStatus === 'draft') {
      await db
        .update(routes)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(routes.id, existing.id));

      seen += 1;
      results.push({ id: existing.id, method: candidate.method, path: candidate.path, status: 'seen' });
      continue;
    }

    skipped += 1;
    results.push({ id: existing.id, method: candidate.method, path: candidate.path, status: 'skipped' });
  }

  return c.json({ created, seen, skipped, routes: results }, 202);
});

export const sdkRoutes = router;
