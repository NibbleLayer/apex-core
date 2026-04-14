import type {
  CreateDiscoveryRequest,
  CreateEnvironmentRequest,
  CreatePriceRequest,
  CreateServiceRequest,
  CreateWalletRequest,
  DiscoveryMetadata,
  Environment,
  PriceRule,
  Route,
  Service,
  WalletDestination,
  WebhookEndpoint,
} from './types';

const API_BASE = '/api';

function getApiKey(): string | null {
  return localStorage.getItem('apex_api_key');
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
    throw new Error(body.error || `HTTP ${response.status}`);
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

  me: () => apiFetch<{ organization_id: string; name: string; slug: string }>('/auth/me'),

  // Services
  listServices: () => apiFetch<Service[]>('/services'),
  getService: (id: string) => apiFetch<Service>(`/services/${id}`),
  createService: (data: CreateServiceRequest) => apiFetch<Service>('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id: string, data: Partial<Pick<Service, 'name' | 'description'>>) =>
    apiFetch<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Environments
  listEnvironments: (serviceId: string) => apiFetch<Environment[]>(`/services/${serviceId}/environments`),
  createEnvironment: (serviceId: string, data: CreateEnvironmentRequest) =>
    apiFetch<Environment>(`/services/${serviceId}/environments`, { method: 'POST', body: JSON.stringify(data) }),

  // Wallets
  listWallets: (serviceId: string) => apiFetch<WalletDestination[]>(`/services/${serviceId}/wallets`),
  createWallet: (serviceId: string, data: CreateWalletRequest) =>
    apiFetch<WalletDestination>(`/services/${serviceId}/wallets`, { method: 'POST', body: JSON.stringify(data) }),

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
  createDiscovery: (routeId: string, data: CreateDiscoveryRequest) =>
    apiFetch<DiscoveryMetadata>(`/routes/${routeId}/discovery`, { method: 'POST', body: JSON.stringify(data) }),

  // Webhooks
  listWebhooks: (serviceId: string) => apiFetch<WebhookEndpoint[]>(`/services/${serviceId}/webhooks`),
  createWebhook: (serviceId: string, data: any) =>
    apiFetch<WebhookEndpoint>(`/services/${serviceId}/webhooks`, { method: 'POST', body: JSON.stringify(data) }),
  updateWebhook: (id: string, data: any) => apiFetch<WebhookEndpoint>(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
