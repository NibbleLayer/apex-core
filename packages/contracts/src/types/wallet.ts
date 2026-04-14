export interface WalletDestination {
  id: string;
  serviceId: string;
  environmentId: string;
  address: string;
  token: string;
  network: string;
  label: string | null;
  active: boolean;
}
