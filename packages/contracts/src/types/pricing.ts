export type PaymentScheme = 'exact';

export interface PriceRule {
  id: string;
  routeId: string;
  scheme: PaymentScheme;
  amount: string;
  token: string;
  network: string;
  active: boolean;
}
