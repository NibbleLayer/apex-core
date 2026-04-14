import { eq, and } from 'drizzle-orm';
import {
  paymentEvents,
  settlements,
  services,
  webhookEndpoints,
  webhookDeliveries,
} from '@nibblelayer/apex-persistence/db';
import { paymentEventPayloadSchema } from '@nibblelayer/apex-contracts/schemas';
import { createId } from '../utils/id.js';
import type { DrizzleInstance } from '../db/types.js';

export interface IngestResult {
  accepted: boolean;
  duplicate: boolean;
}

type ParsedEventPayload = typeof paymentEventPayloadSchema._type;

interface EventValidationFailure {
  ok: false;
  status: 400;
  body: { error: string };
}

interface EventValidationSuccess {
  ok: true;
  payload: ParsedEventPayload;
}

export function validateEventPayload(rawPayload: unknown): EventValidationFailure | EventValidationSuccess {
  const parsed = paymentEventPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: parsed.error.issues.map((issue) => issue.message).join(', ') },
    };
  }

  return {
    ok: true,
    payload: parsed.data,
  };
}

export function buildSettlementRecord(payload: ParsedEventPayload, paymentEventId: string) {
  return {
    id: createId(),
    serviceId: payload.serviceId,
    routeId: payload.routeId,
    paymentEventId,
    amount: payload.amount ?? '0',
    token: payload.token ?? 'unknown',
    network: payload.network ?? 'unknown',
    settlementReference: payload.settlementReference ?? null,
    status: 'confirmed' as const,
  };
}

export function buildWebhookDeliveries(
  endpoints: Array<{ id: string }>,
  eventId: string,
  rawPayload: unknown,
  type: ParsedEventPayload['type'],
  createdAt = new Date(),
) {
  return endpoints.map((endpoint) => ({
    id: createId(),
    webhookEndpointId: endpoint.id,
    eventId,
    payload: {
      id: eventId,
      type,
      created_at: createdAt.toISOString(),
      data: rawPayload,
    },
    status: 'pending' as const,
    attempts: 0,
  }));
}

/**
 * Ingest a payment event:
 * 1. Validate payload against Zod schema
 * 2. Deduplicate by (request_id, type)
 * 3. Persist to payment_events table
 * 4. If payment.settled, create/update settlement record
 * 5. Enqueue webhook deliveries for all enabled endpoints on this service
 */
export async function ingestEvent(
  db: DrizzleInstance,
  rawPayload: unknown,
  orgId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const validation = validateEventPayload(rawPayload);
  if (!validation.ok) {
    return {
      status: validation.status,
      body: validation.body,
    };
  }

  const payload = validation.payload;

  // Verify service belongs to the authenticated org
  const [svc] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, payload.serviceId), eq(services.organizationId, orgId)))
    .limit(1);

  if (!svc) {
    return { status: 404, body: { error: 'Service not found' } };
  }

  // 2. Deduplicate by (request_id, type)
  const [existing] = await db
    .select({ id: paymentEvents.id })
    .from(paymentEvents)
    .where(
      and(
        eq(paymentEvents.requestId, payload.requestId),
        eq(paymentEvents.type, payload.type),
      ),
    )
    .limit(1);

  if (existing) {
    return { status: 202, body: { accepted: true } };
  }

  // 3. Persist to payment_events table
  const id = createId();
  await db.insert(paymentEvents).values({
    id,
    serviceId: payload.serviceId,
    routeId: payload.routeId,
    type: payload.type,
    requestId: payload.requestId,
    paymentIdentifier: payload.paymentIdentifier ?? null,
    buyerAddress: payload.buyerAddress ?? null,
    payload: rawPayload as Record<string, unknown>,
  });

  // 4. If payment.settled, create settlement record
  if (payload.type === 'payment.settled') {
    await db.insert(settlements).values(buildSettlementRecord(payload, id));
  }

  // 5. Enqueue webhook deliveries for all enabled endpoints on this service
  const enabledEndpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.serviceId, payload.serviceId),
        eq(webhookEndpoints.enabled, true),
      ),
    );

  if (enabledEndpoints.length > 0) {
    await db
      .insert(webhookDeliveries)
      .values(buildWebhookDeliveries(enabledEndpoints, id, rawPayload, payload.type));
  }

  return { status: 202, body: { accepted: true } };
}
