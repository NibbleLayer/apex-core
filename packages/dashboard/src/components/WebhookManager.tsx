import { createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../api/client';

interface WebhookManagerProps {
  serviceId: string;
}

export function WebhookManager(props: WebhookManagerProps) {
  const [webhooks, setWebhooks] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [showCreate, setShowCreate] = createSignal(false);
  const [url, setUrl] = createSignal('');
  const [newSecret, setNewSecret] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  async function loadWebhooks() {
    try {
      setLoading(true);
      const data = await api.listWebhooks(props.serviceId);
      setWebhooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }

  onMount(loadWebhooks);

  async function handleCreate(e: Event) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api.createWebhook(props.serviceId, { url: url() });
      setNewSecret(result.secret || '');
      setShowCreate(false);
      setUrl('');
      loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setSaving(false);
    }
  }

  async function toggleWebhook(webhook: any) {
    try {
      await api.updateWebhook(webhook.id, { enabled: !webhook.enabled });
      loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    }
  }

  function dismissSecret() {
    setNewSecret('');
  }

  return (
    <div>
      <Show when={newSecret()}>
        <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
          <p class="text-sm font-medium text-yellow-800 mb-2">
            Webhook Secret (save this now — it won't be shown again)
          </p>
          <div class="flex items-center gap-2">
            <code class="bg-white px-3 py-1.5 rounded border text-sm font-mono flex-1 break-all">
              {newSecret()}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newSecret())}
              class="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded"
            >
              Copy
            </button>
            <button
              onClick={dismissSecret}
              class="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error()}</div>
      </Show>

      <div class="flex justify-end mb-4">
        <button
          onClick={() => setShowCreate(!showCreate())}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showCreate() ? 'Cancel' : '+ Add Webhook'}
        </button>
      </div>

      <Show when={showCreate()}>
        <form onSubmit={handleCreate} class="bg-white p-4 rounded-lg shadow mb-4">
          <div class="flex gap-3 items-end">
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-600 mb-1">Endpoint URL *</label>
              <input
                type="url"
                required
                value={url()}
                onInput={(e) => setUrl(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="https://example.com/webhooks/apex"
              />
            </div>
            <button
              type="submit"
              disabled={saving() || !url().trim()}
              class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {saving() ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Show>

      <Show when={loading()}>
        <p class="text-gray-500">Loading webhooks...</p>
      </Show>

      <Show when={!loading() && webhooks().length === 0}>
        <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No webhook endpoints configured. Create one to receive payment event notifications.
        </div>
      </Show>

      <div class="space-y-2">
        <For each={webhooks()}>
          {(webhook) => (
            <div class="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div class="flex-1">
                <p class="text-sm font-mono text-gray-900 truncate">{webhook.url}</p>
                <p class="text-xs text-gray-400 mt-1">Created {new Date(webhook.created_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => toggleWebhook(webhook)}
                class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ml-4 ${
                  webhook.enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  class={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    webhook.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
