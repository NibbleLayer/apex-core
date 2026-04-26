import type {
  CreateDiscoveryRequest,
  WebhookDeliveriesResponse,
  CreateEnvironmentRequest,
  CreateSdkTokenRequest,
  CreatePriceRequest,
  CreateServiceRequest,
  CreateServiceDomainRequest,
  CreateWalletRequest,
  DiscoveryMetadata,
  DiscoveryPreviewResponse,
  Environment,
  PriceRule,
  Route,
  SdkTokenCreateResponse,
  Service,
  ServiceDomain,
  WalletDestination,
  WebhookEndpoint,
} from './types';

const API_BASE = '/api';

function getApiKey(): string | null {
  return localStorage.getItem('apex_api_key');
}

export function getMaskedAdminApiKey(): string | null {
  const key = getApiKey();
  if (!key) return null;
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function setApiKey(key: string): void {
  localStorage.setItem('apex_api_key', key);
}

export function clearApiKey(): void {
  localStorage.removeItem('apex_api_key');
}

export function isAuthenticated(): boolean {
  return !!getApiKey();
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const key = getApiKey();
  const hasBody = options?.body !== undefined;
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(options?.headers as Record<string, string>),
  };
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearApiKey();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    const qualityDetails = Array.isArray(body.qualityChecks)
      ? `: ${body.qualityChecks.map((check: { message: string }) => check.message).join(' ')}`
      : '';
    throw new Error(`${body.error || `HTTP ${response.status}`}${qualityDetails}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (apiKey: string) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    }).then(r => { if (!r.ok) throw new Error('Invalid API key'); return r.json(); }),

  me: () => apiFetch<{ organizationId: string; name: string; slug: string }>('/auth/me'),

  // Services
  listServices: () => apiFetch<Service[]>('/services'),
  getService: (id: string) => apiFetch<Service>(`/services/${id}`),
  createService: (data: CreateServiceRequest) => apiFetch<Service>('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: string, data: Partial<Pick<Service, 'name' | 'description'>>) =>
    apiFetch<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Domains
  listDomains: (serviceId: string) => apiFetch<ServiceDomain[]>(`/services/${serviceId}/domains`),
  createDomain: (serviceId: string, data: CreateServiceDomainRequest) =>
    apiFetch<ServiceDomain>(`/services/${serviceId}/domains`, { method: 'POST', body: JSON.stringify(data) }),
  verifyDomain: (id: string) => apiFetch<ServiceDomain & { verification: unknown }>(`/domains/${id}/verify`, { method: 'POST' }),

  // Environments
  listEnvironments: (serviceId: string) => apiFetch<Environment[]>(`/services/${serviceId}/environments`),
  createEnvironment: (serviceId: string, data: CreateEnvironmentRequest) =>
    apiFetch<Environment>(`/services/${serviceId}/environments`, { method: 'POST', body: JSON.stringify(data) }),

  // Wallets
  listWallets: (serviceId: string) => apiFetch<WalletDestination[]>(`/services/${serviceId}/wallets`),
  createWallet: (serviceId: string, data: CreateWalletRequest) =>
    apiFetch<WalletDestination>(`/services/${serviceId}/wallets`, { method: 'POST', body: JSON.stringify(data) }),

  // SDK Tokens
  createSdkToken: (serviceId: string, data: CreateSdkTokenRequest) =>
    apiFetch<SdkTokenCreateResponse>(`/services/${serviceId}/sdk-tokens`, { method: 'POST', body: JSON.stringify(data) }),

  // Routes
  listRoutes: (serviceId: string) => apiFetch<Route[]>(`/services/${serviceId}/routes`),
  createRoute: (serviceId: string, data: any) =>
    apiFetch<Route>(`/services/${serviceId}/routes`, { method: 'POST', body: JSON.stringify(data) }),
  updateRoute: (id: string, data: any) => apiFetch<Route>(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Pricing
  listPricing: (routeId: string) => apiFetch<PriceRule[]>(`/routes/${routeId}/pricing`),
  createPrice: (routeId: string, data: CreatePriceRequest) =>
    apiFetch<PriceRule>(`/routes/${routeId}/pricing`, { method: 'POST', body: JSON.stringify(data) }),

  // Manifest
  getManifest: (serviceId: string, env: string) =>
    apiFetch<any>(`/services/${serviceId}/manifest?env=${env}`),

  // Events
  listEvents: (serviceId: string, params?: string) =>
    apiFetch<any>(`/services/${serviceId}/events${params ? `?${params}` : ''}`),

  // Settlements
  listSettlements: (serviceId: string, params?: string) =>
    apiFetch<any>(`/services/${serviceId}/settlements${params ? `?${params}` : ''}`),

  // Discovery
  getDiscovery: (routeId: string) => apiFetch<DiscoveryMetadata>(`/routes/${routeId}/discovery`),
  getDiscoveryPreview: (routeId: string) => apiFetch<DiscoveryPreviewResponse>(`/routes/${routeId}/discovery/preview`),
  createDiscovery: (routeId: string, data: CreateDiscoveryRequest) =>
    apiFetch<DiscoveryMetadata>(`/routes/${routeId}/discovery`, { method: 'POST', body: JSON.stringify(data) }),

  // Webhooks
  listWebhooks: (serviceId: string) => apiFetch<WebhookEndpoint[]>(`/services/${serviceId}/webhooks`),
  listWebhookDeliveries: (serviceId: string, status?: string) =>
    apiFetch<WebhookDeliveriesResponse>(`/services/${serviceId}/webhook-deliveries${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createWebhook: (serviceId: string, data: any) =>
    apiFetch<WebhookEndpoint>(`/services/${serviceId}/webhooks`, { method: 'POST', body: JSON.stringify(data) }),
  updateWebhook: (id: string, data: any) => apiFetch<WebhookEndpoint>(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
