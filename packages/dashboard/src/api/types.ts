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
  source?: 'dashboard' | 'sdk';
  publicationStatus?: 'draft' | 'published';
  lastSeenAt?: string | null;
  updatedAt?: string;
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

export interface CreateSdkTokenRequest {
  environment: 'test' | 'prod';
  label?: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface ServiceDomain {
  id: string;
  organizationId: string;
  serviceId: string;
  domain: string;
  verificationToken: string;
  verificationMethod: 'dns_txt';
  status: 'pending' | 'verified' | 'failed';
  dnsRecordName: string;
  dnsRecordValue: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceDomainRequest {
  domain: string;
}

export interface SdkTokenCreateResponse {
  id: string;
  token: string;
  serviceId?: string;
  environment: 'test' | 'prod';
  scopes: string[];
  expiresAt?: string | null;
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
  reviewStatus?: 'draft' | 'in_review' | 'published' | 'rejected';
  indexingStatus?: 'not_submitted' | 'queued' | 'indexed' | 'failed';
  indexingError?: string | null;
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
  updatedAt?: string;
}

export interface WebhookDelivery {
  id: string;
  endpointUrl: string;
  status: 'pending' | 'delivered' | 'failed' | 'dead_lettered';
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  lastError: string | null;
  eventId: string;
  createdAt: string;
}

export interface WebhookDeliveriesResponse {
  deliveries: WebhookDelivery[];
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
  reviewStatus: 'draft' | 'in_review' | 'published' | 'rejected';
  indexingStatus: 'not_submitted' | 'queued' | 'indexed' | 'failed';
  indexingError: string | null;
  updatedAt?: string;
}

export interface DiscoveryQualityCheck {
  level: 'error' | 'warning';
  message: string;
}

export interface DiscoveryPreviewResponse {
  preview: {
    method: string;
    path: string;
    title: string;
    summary: string;
    category: string | null;
    tags: string[];
    mimeType: string | null;
    docsUrl: string | null;
    schemas: {
      input: Record<string, unknown> | null;
      output: Record<string, unknown> | null;
    };
    status: {
      reviewStatus: 'draft' | 'in_review' | 'published' | 'rejected';
      indexingStatus: 'not_submitted' | 'queued' | 'indexed' | 'failed';
      indexingError: string | null;
      published: boolean;
      discoverable: boolean;
    };
  };
  qualityChecks: DiscoveryQualityCheck[];
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
