import type {
  PaymentEventPayload,
  PaymentEventType,
} from '@nibblelayer/apex-contracts';
import { paymentEventPayloadSchema } from '@nibblelayer/apex-contracts/schemas';

export interface EventEmitterConfig {
  apexUrl: string;
  apiKey: string;
  serviceId: string;
  eventsEndpoint?: string;
  maxRetries?: number;
}

interface QueuedEvent {
  payload: PaymentEventPayload;
  retries: number;
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

  /**
   * Emit an event to the Apex control plane.
   * Fire-and-forget: does not block the payment flow.
   */
  emit(type: string, data: Record<string, unknown>): void {
    const payload: PaymentEventPayload = {
      serviceId: this.config.serviceId,
      routeId: data.routeId as string,
      type: type as PaymentEventType,
      requestId: data.requestId as string,
      paymentIdentifier: data.paymentIdentifier as string | undefined,
      buyerAddress: data.buyerAddress as string | undefined,
      amount: data.amount as string | undefined,
      token: data.token as string | undefined,
      network: data.network as string | undefined,
      settlementReference: data.settlementReference as string | undefined,
      error: data.error as string | undefined,
      timestamp: new Date().toISOString(),
    };

    // Validate payload against schema
    const result = paymentEventPayloadSchema.safeParse(payload);
    if (!result.success) {
      console.error('Invalid event payload:', result.error.issues);
      return;
    }

    this.queue.push({ payload: result.data, retries: 0 });
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
