import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, setApiKey } from '../api/client';

export default function Login() {
  const [key, setKey] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const navigate = useNavigate();

  async function handleLogin(e: Event) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      setApiKey(key().trim());
      await api.me();
      navigate('/');
    } catch (err) {
      setError('Invalid API key');
      localStorage.removeItem('apex_api_key');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 class="text-2xl font-bold text-center mb-6">Apex</h1>
        <p class="text-gray-500 text-center mb-6">Merchant Control Plane</p>
        <form onSubmit={handleLogin}>
          <label class="block text-sm font-medium text-gray-700 mb-2">API Key</label>
          <input
            type="password"
            value={key()}
            onInput={(e) => setKey(e.currentTarget.value)}
            placeholder="apex_..."
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error() && <p class="text-red-600 text-sm mt-2">{error()}</p>}
          <button
            type="submit"
            disabled={loading() || !key().trim()}
            class="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading() ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
