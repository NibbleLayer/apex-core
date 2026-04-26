import type { PaymentScheme } from './pricing.js';

export interface ManifestRouteAccepts {
  scheme: PaymentScheme;
  price: string;
  network: string;
  payTo: string;
}

export interface ManifestRouteExtensions {
  'payment-identifier'?: {
    required: boolean;
  };
  apex?: {
    routeId: string;
    routeKey: string;
  };
  bazaar?: {
    discoverable: boolean;
    category?: string;
    tags?: string[];
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  };
}

export interface ManifestRoute {
  accepts: ManifestRouteAccepts[];
  description?: string;
  mimeType?: string;
  extensions?: ManifestRouteExtensions;
}

export interface ManifestWallet {
  address: string;
  token: string;
  network: string;
}

export interface ApexManifest {
  serviceId: string;
  environment: 'test' | 'prod';
  version: number;
  network: string;
  facilitatorUrl: string;
  wallet: ManifestWallet;
  verifiedDomains: string[];
  routes: Record<string, ManifestRoute>;
  eventsEndpoint: string;
  idempotencyEnabled: boolean;
  refreshIntervalMs: number;
  checksum: string;
}

export interface ManifestSignature {
  alg: 'HS256';
  kid: string;
  issuedAt: string;
  expiresAt?: string;
  payloadDigest: string;
  value: string;
}

export interface SignedManifestEnvelope {
  manifest: ApexManifest;
  signature: ManifestSignature;
}
