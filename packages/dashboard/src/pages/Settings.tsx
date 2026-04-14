import { createSignal, For, Show, onMount } from 'solid-js';
import { api, isAuthenticated } from '../api/client';
import { WebhookManager } from '../components/WebhookManager';

export default function Settings() {
  const [services, setServices] = createSignal<any[]>([]);
  const [selectedService, setSelectedService] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  async function loadServices() {
    try {
      setLoading(true);
      const data = await api.listServices();
      setServices(data);
      if (data.length > 0) {
        setSelectedService(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }

  onMount(loadServices);

  const maskedKey = () => {
    const key = localStorage.getItem('apex_api_key') || '';
    if (key.length <= 8) return key;
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  };

  function copyApiKey() {
    const key = localStorage.getItem('apex_api_key') || '';
    navigator.clipboard.writeText(key);
  }

  return (
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error()}</div>
      </Show>

      {/* API Key section */}
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">API Key</h2>
        <div class="flex items-center gap-3">
          <code class="bg-gray-50 px-4 py-2 rounded border text-sm font-mono flex-1">
            {maskedKey()}
          </code>
          <button
            onClick={copyApiKey}
            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            Copy
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-2">
          Your API key is stored locally in this browser. Keep it secure.
        </p>
      </div>

      {/* Webhook Management */}
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Webhook Endpoints</h2>

        <Show when={loading()}>
          <p class="text-gray-500">Loading services...</p>
        </Show>

        <Show when={!loading()}>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Service</label>
            <select
              value={selectedService()}
              onChange={(e) => setSelectedService(e.currentTarget.value)}
              class="px-3 py-2 border rounded-lg text-sm"
            >
              <For each={services()}>
                {(svc) => <option value={svc.id}>{svc.name}</option>}
              </For>
            </select>
          </div>

          <Show when={selectedService()}>
            <WebhookManager serviceId={selectedService()} />
          </Show>
        </Show>
      </div>
    </div>
  );
}
