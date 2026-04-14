export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Service {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  routeCount?: number;
  environments?: Environment[];
  routes?: Route[];
}

export interface Environment {
  id: string;
  serviceId: string;
  mode: 'test' | 'prod';
  network: string;
  facilitatorUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: string;
  serviceId: string;
  method: string;
  path: string;
  description: string | null;
  enabled: boolean;
  pricing?: PriceRule[];
  discovery?: DiscoveryMetadata;
}

export interface PriceRule {
  id: string;
  routeId: string;
  scheme: 'exact';
  amount: string;
  token: string;
  network: string;
  active: boolean;
}

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

export interface CreateServiceRequest {
  name: string;
  slug: string;
  description?: string;
}

export interface CreateEnvironmentRequest {
  mode: 'test' | 'prod';
  network: string;
  facilitatorUrl?: string;
}

export interface CreateWalletRequest {
  environmentId: string;
  address: string;
  token: string;
  network: string;
  label?: string;
}

export interface CreatePriceRequest {
  scheme: 'exact';
  amount: string;
  token: string;
  network: string;
}

export interface CreateDiscoveryRequest {
  discoverable: boolean;
  category?: string;
  tags?: string[];
  description?: string;
  mimeType?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  docsUrl?: string;
  published?: boolean;
}

export interface PaymentEvent {
  id: string;
  serviceId: string;
  routeId: string;
  type: string;
  requestId: string;
  paymentIdentifier: string | null;
  buyerAddress: string | null;
  payload: unknown;
  createdAt: string;
}

export interface Settlement {
  id: string;
  serviceId: string;
  routeId: string;
  amount: string;
  token: string;
  network: string;
  settlementReference: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: string;
}

export interface DiscoveryMetadata {
  id: string;
  routeId: string;
  discoverable: boolean;
  category: string | null;
  tags: string[] | null;
  description: string | null;
  mimeType: string | null;
  inputSchema: Record<string, unknown> | null;
  outputSchema: Record<string, unknown> | null;
  docsUrl: string | null;
  published: boolean;
}

export interface WebhookEndpoint {
  id: string;
  serviceId: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  secret?: string; // Only present on creation
}
