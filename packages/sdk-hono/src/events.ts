import type {
  PaymentEventPayload,
  PaymentEventType,
} from '@nibblelayer/apex-contracts';
import { paymentEventPayloadSchema } from '@nibblelayer/apex-contracts/schemas';

export interface EventEmitterConfig {
  apexUrl: string;
  apiKey: string;
  serviceId?: string;
  eventsEndpoint?: string;
  maxRetries?: number;
}

interface QueuedEvent {
  payload: PaymentEventPayload;
  retries: number;
}

export function buildPaymentEventPayload(input: {
  serviceId: string;
  type: string;
  data: Record<string, unknown>;
  now?: Date;
}): PaymentEventPayload | null {
  const requirements = asRecord(input.data.requirements);
  const extensions = asRecord(requirements?.extensions);
  const apexExtensions = asRecord(extensions?.apex);
  const firstAccept = firstRecord(requirements?.accepts);
  const paymentPayload = asRecord(input.data.paymentPayload);
  const paymentPayloadBody = asRecord(paymentPayload?.payload);
  const authorization = asRecord(paymentPayloadBody?.authorization);
  const resultPayload = asRecord(input.data.result);

  const routeId = firstString(input.data.routeId, apexExtensions?.routeId);
  const paymentIdentifier = firstString(
    input.data.paymentIdentifier,
    paymentPayload?.paymentIdentifier,
    paymentPayload?.nonce,
    authorization?.nonce,
  );
  const requestId = firstString(input.data.requestId, paymentIdentifier);

  const payload: PaymentEventPayload = {
    serviceId: input.serviceId,
    routeId: routeId as string,
    type: input.type as PaymentEventType,
    requestId: requestId as string,
    paymentIdentifier: paymentIdentifier ?? '',
    buyerAddress: firstString(
      input.data.buyerAddress,
      paymentPayload?.buyerAddress,
      authorization?.from,
    ),
    amount: firstString(
      input.data.amount,
      firstAccept?.price,
      firstAccept?.maxAmountRequired,
    ),
    token: firstString(input.data.token, firstAccept?.asset, firstAccept?.token),
    network: firstString(input.data.network, firstAccept?.network),
    settlementReference: firstString(
      input.data.settlementReference,
      resultPayload?.transaction,
      resultPayload?.txHash,
      resultPayload?.settlementReference,
    ),
    error: normalizeError(input.data.error),
    timestamp: (input.now ?? new Date()).toISOString(),
  };

  const validation = paymentEventPayloadSchema.safeParse(payload);
  if (!validation.success) {
    console.error('Invalid event payload:', validation.error.issues);
    return null;
  }

  return validation.data;
}

export class SDKEventEmitter {
  private maxRetries: number;
  private queue: QueuedEvent[] = [];
  private processing = false;
  private eventsUrl: string;

  constructor(private config: EventEmitterConfig) {
    this.maxRetries = config.maxRetries ?? 3;
    this.eventsUrl = resolveEventsUrl(config.apexUrl, config.eventsEndpoint);
  }

  setEventsEndpoint(eventsEndpoint: string): void {
    this.eventsUrl = resolveEventsUrl(this.config.apexUrl, eventsEndpoint);
  }

  setServiceId(serviceId: string): void {
    this.config.serviceId = serviceId;
  }

  /**
   * Emit an event to the Apex control plane.
   * Fire-and-forget: does not block the payment flow.
   */
  emit(type: string, data: Record<string, unknown>): void {
    if (!this.config.serviceId) {
      console.error('Cannot emit Apex payment event before manifest serviceId is known:', type);
      return;
    }

    const payload = buildPaymentEventPayload({
      serviceId: this.config.serviceId,
      type,
      data,
    });
    if (!payload) {
      return;
    }

    this.queue.push({ payload, retries: 0 });
    this.processQueue().catch(() => {
      /* errors logged internally */
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      try {
        const response = await fetch(this.eventsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(item.payload),
        });

        if (response.ok || response.status === 202) {
          this.queue.shift();
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        item.retries++;
        if (item.retries > this.maxRetries) {
          this.queue.shift();
          console.error(
            `Failed to emit event after ${this.maxRetries} retries:`,
            item.payload.type,
            error,
          );
        } else {
          // Exponential backoff: 1s × retry count
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * item.retries),
          );
        }
      }
    }

    this.processing = false;
  }

  /** Get the number of queued events (for testing) */
  get pendingCount(): number {
    return this.queue.length;
  }
}

function resolveEventsUrl(apexUrl: string, eventsEndpoint = '/events'): string {
  return new URL(eventsEndpoint, apexUrl).toString();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function firstRecord(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return asRecord(value[0]);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function normalizeError(value: unknown): string | undefined {
  if (value instanceof Error) {
    return value.message;
  }

  return firstString(value);
}
