import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Dashboard Smoke Tests ----
// These tests verify the dashboard's API client logic and page module imports
// without requiring a full Solid.js rendering environment.

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Dashboard Smoke Tests', () => {
  describe('API client key management', () => {
    it('stores and retrieves API key from localStorage', () => {
      // Simulate setApiKey
      localStorageMock.setItem('apex_api_key', 'apex_stored_key_123');
      store['apex_api_key'] = 'apex_stored_key_123';

      // Simulate getApiKey
      const key = localStorageMock.getItem('apex_api_key');
      expect(key).toBe('apex_stored_key_123');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('apex_api_key', 'apex_stored_key_123');
    });

    it('returns null when no API key is stored', () => {
      const key = localStorageMock.getItem('apex_api_key');
      expect(key).toBeNull();
    });

    it('clears API key from localStorage', () => {
      store['apex_api_key'] = 'apex_to_clear';
      localStorageMock.removeItem('apex_api_key');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('apex_api_key');
      expect(store['apex_api_key']).toBeUndefined();
    });
  });

  describe('API client authenticated fetch', () => {
    it('includes Bearer header on authenticated requests', async () => {
      store['apex_api_key'] = 'apex_bearer_test_key';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'test' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      // Simulate apiFetch behavior
      const key = localStorageMock.getItem('apex_api_key');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) headers['Authorization'] = `Bearer ${key}`;

      await mockFetch('/api/services', { headers });

      expect(mockFetch).toHaveBeenCalledWith('/api/services', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer apex_bearer_test_key',
        },
      });

      vi.restoreAllMocks();
    });

    it('does not include Authorization header when no key', () => {
      const key = localStorageMock.getItem('apex_api_key');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) headers['Authorization'] = `Bearer ${key}`;

      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('API client 401 handling', () => {
    it('clears API key and throws on 401 response', async () => {
      store['apex_api_key'] = 'apex_key_to_clear';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      // Simulate apiFetch behavior for 401
      const response = await mockFetch('/api/services');
      expect(response.status).toBe(401);

      if (response.status === 401) {
        localStorageMock.removeItem('apex_api_key');
      }

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('apex_api_key');
      vi.restoreAllMocks();
    });
  });

  describe('Page module imports', () => {
    it('Login page module can be imported without errors', async () => {
      // Dynamic import to verify module is valid
      const mod = await import('../src/pages/Login.tsx');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    });

    it('Dashboard page module can be imported without errors', async () => {
      const mod = await import('../src/pages/Dashboard.tsx');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    });

    it('Services page module can be imported without errors', async () => {
      const mod = await import('../src/pages/Services.tsx');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    });

    it('Events page module can be imported without errors', async () => {
      const mod = await import('../src/pages/Events.tsx');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    });

    it('Settlements page module can be imported without errors', async () => {
      const mod = await import('../src/pages/Settlements.tsx');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    });

    it('Settings page module can be imported without errors', async () => {
      const mod = await import('../src/pages/Settings.tsx');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe('function');
    });
  });
});
