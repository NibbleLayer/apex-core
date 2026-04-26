export type PaymentEventType =
  | 'payment.required'
  | 'payment.verified'
  | 'payment.settled'
  | 'payment.failed'
  | 'payment.replay';

export interface PaymentEvent {
  id: string;
  serviceId: string;
  routeId: string;
  type: PaymentEventType;
  requestId: string;
  paymentIdentifier: string | null;
  buyerAddress: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface PaymentEventPayload {
  serviceId: string;
  routeId: string;
  type: PaymentEventType;
  requestId: string;
  paymentIdentifier: string;
  buyerAddress?: string;
  amount?: string;
  token?: string;
  network?: string;
  settlementReference?: string;
  error?: string;
  timestamp: string;
}
