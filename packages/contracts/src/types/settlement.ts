export type SettlementStatus = 'pending' | 'confirmed' | 'failed';

export interface Settlement {
  id: string;
  serviceId: string;
  routeId: string;
  paymentEventId: string;
  amount: string;
  token: string;
  network: string;
  settlementReference: string | null;
  status: SettlementStatus;
  createdAt: Date;
}
