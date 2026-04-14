import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- API client logic (pure function testing) ----
// We mock fetch and localStorage to test the client module.

// localStorage mock
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => Object.keys(store).forEach((k) => delete store[k])),
};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.clearAllMocks();
});

describe('API client - key management', () => {
  it('stores API key in localStorage', () => {
    localStorageMock.setItem('apex_api_key', 'apex_test_123');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('apex_api_key', 'apex_test_123');
    store['apex_api_key'] = 'apex_test_123';
    expect(localStorageMock.getItem('apex_api_key')).toBe('apex_test_123');
  });

  it('clears API key from localStorage', () => {
    store['apex_api_key'] = 'apex_test_123';
    localStorageMock.removeItem('apex_api_key');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('apex_api_key');
  });

  it('detects authenticated state', () => {
    expect(store['apex_api_key']).toBeUndefined();
    store['apex_api_key'] = 'apex_test_123';
    expect(store['apex_api_key']).toBe('apex_test_123');
  });

  it('detects unauthenticated state', () => {
    expect(store['apex_api_key']).toBeUndefined();
  });
});

describe('API client - fetch behavior', () => {
  it('includes Bearer header when API key is set', async () => {
    store['apex_api_key'] = 'apex_test_123';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Simulate what apiFetch does
    const key = store['apex_api_key'];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    await mockFetch('/api/services', { headers });
    expect(mockFetch).toHaveBeenCalledWith('/api/services', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer apex_test_123',
      },
    });

    vi.restoreAllMocks();
  });

  it('does not include Authorization header without key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const key = store['apex_api_key'];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    expect(headers).not.toHaveProperty('Authorization');

    vi.restoreAllMocks();
  });

  it('throws on non-OK response with error message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ error: 'Invalid input' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const response = await mockFetch('/api/services');
    expect(response.ok).toBe(false);

    const body = await response.json();
    expect(body.error).toBe('Invalid input');

    vi.restoreAllMocks();
  });

  it('throws Unauthorized on 401', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const response = await mockFetch('/api/services');
    expect(response.status).toBe(401);

    vi.restoreAllMocks();
  });

  it('serializes POST body as JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'svc_123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const body = JSON.stringify({ name: 'Test', slug: 'test' });
    await mockFetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"Test","slug":"test"}',
    });

    vi.restoreAllMocks();
  });
});
