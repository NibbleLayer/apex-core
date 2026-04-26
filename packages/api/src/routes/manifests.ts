import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import type { ApexManifest } from '@nibblelayer/apex-contracts';
import { services, serviceManifests, environments } from '@nibblelayer/apex-persistence/db';
import { authMiddleware } from '../middleware/auth.js';
import { sdkAuthMiddleware } from '../middleware/sdk-auth.js';
import { getDb } from '../db/resolver.js';
import { generateManifest } from '../services/config-service.js';
import { signManifestEnvelope } from '../services/manifest-signing.js';

const router = new Hono();

function parseManifestEnvironment(env: string | undefined) {
  if (!env || (env !== 'test' && env !== 'prod')) {
    return null;
  }

  return env;
}

async function getManifestForService({
  serviceId,
  orgId,
  env,
}: {
  serviceId: string;
  orgId: string;
  env: 'test' | 'prod';
}): Promise<{ manifest: ApexManifest } | { error: string; status: 404 }> {
  const db = await getDb();

  // Verify service belongs to the authenticated org
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return { error: 'Service not found', status: 404 };
  }

  // Get environment for this mode
  const [environment] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.serviceId, serviceId), eq(environments.mode, env)))
    .limit(1);

  if (!environment) {
    return { error: `No ${env} environment configured for this service`, status: 404 };
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
    const payload = existing.payload as Partial<ApexManifest>;
    if (Array.isArray(payload.verifiedDomains)) {
      return { manifest: payload as ApexManifest };
    }
  }

  // No manifest exists — generate one on-demand
  try {
    const { manifest } = await generateManifest(db, serviceId, env);
    return { manifest };
  } catch (err: any) {
    return { error: `Cannot generate manifest: ${err.message}`, status: 404 };
  }
}

// GET /services/:id/manifest - Get latest manifest for a service
router.get('/services/:id/manifest', authMiddleware, async (c) => {
  const serviceId = c.req.param('id');
  const orgId = c.get('organizationId');
  const env = parseManifestEnvironment(c.req.query('env'));

  if (!env) {
    return c.json({ error: 'Query parameter "env" must be "test" or "prod"' }, 400);
  }

  const result = await getManifestForService({ serviceId, orgId, env });
  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }

  return c.json(result.manifest);
});

// GET /sdk/manifest - Get signed SDK manifest envelope
router.get('/sdk/manifest', sdkAuthMiddleware, async (c) => {
  const serviceId = c.get('serviceId');
  const orgId = c.get('organizationId');
  const sdkTokenId = c.get('sdkTokenId');
  const rawSdkToken = c.get('sdkTokenRaw');
  const env = c.get('environmentMode') as 'test' | 'prod';
  const requestedServiceId = c.req.query('serviceId');
  const requestedEnv = c.req.query('env');

  if (requestedServiceId && requestedServiceId !== serviceId) {
    return c.json({ error: 'SDK token is not scoped to the requested service' }, 403);
  }

  if (requestedEnv && requestedEnv !== env) {
    return c.json({ error: 'SDK token is not scoped to the requested environment' }, 403);
  }

  const result = await getManifestForService({ serviceId, orgId, env });
  if ('error' in result) {
    return c.json({ error: result.error }, result.status);
  }

  const envelope = signManifestEnvelope({
    manifest: result.manifest,
    rawApiKey: rawSdkToken,
    keyId: sdkTokenId,
  });

  return c.json(envelope);
});

export const manifestRoutes = router;
