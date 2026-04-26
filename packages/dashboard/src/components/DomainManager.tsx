import { createSignal, For, onMount, Show } from 'solid-js';
import { api } from '../api/client';
import type { ServiceDomain } from '../api/types';
import { formatDate } from '../utils/format';

export function DomainManager(props: { serviceId: string }) {
  const [domains, setDomains] = createSignal<ServiceDomain[]>([]);
  const [domain, setDomain] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  async function loadDomains() {
    setLoading(true);
    try {
      setDomains(await api.listDomains(props.serviceId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  }

  async function createDomain(e: Event) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createDomain(props.serviceId, { domain: domain() });
      setDomain('');
      await loadDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create domain');
    } finally {
      setSaving(false);
    }
  }

  async function verifyDomain(id: string) {
    setError('');
    try {
      await api.verifyDomain(id);
      await loadDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify domain');
    }
  }

  onMount(loadDomains);

  return (
    <div class="space-y-4">
      <form onSubmit={createDomain} class="bg-white p-4 rounded-lg shadow space-y-3">
        <h3 class="font-semibold text-gray-900">Service Domains</h3>
        <p class="text-sm text-gray-500">Add a public domain and publish the DNS TXT proof record before verification.</p>
        <div class="flex gap-2">
          <input
            value={domain()}
            onInput={(e) => setDomain(e.currentTarget.value)}
            placeholder="weather.example.com"
            class="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button disabled={saving()} class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
            {saving() ? 'Adding...' : 'Add Domain'}
          </button>
        </div>
      </form>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-3 rounded text-sm">{error()}</div>
      </Show>

      <Show when={loading()}>
        <p class="text-gray-500">Loading domains...</p>
      </Show>

      <For each={domains()}>
        {(entry) => (
          <div class="bg-white rounded-lg shadow p-4 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium text-gray-900">{entry.domain}</p>
                <p class="text-xs text-gray-500">Created {entry.createdAt ? formatDate(entry.createdAt) : 'recently'}</p>
              </div>
              <span class={`text-xs px-2 py-1 rounded ${entry.status === 'verified' ? 'bg-green-50 text-green-700' : entry.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                {entry.status}
              </span>
            </div>

            <div class="bg-gray-50 rounded p-3 text-sm">
              <p class="font-medium text-gray-700 mb-2">DNS TXT record</p>
              <div class="grid md:grid-cols-2 gap-2">
                <div>
                  <span class="block text-xs text-gray-500">Name</span>
                  <code class="break-all">{entry.dnsRecordName}</code>
                </div>
                <div>
                  <span class="block text-xs text-gray-500">Value</span>
                  <code class="break-all">{entry.dnsRecordValue}</code>
                </div>
              </div>
            </div>

            <Show when={entry.failureReason}>
              <p class="text-sm text-red-600">{entry.failureReason}</p>
            </Show>

            <button onClick={() => verifyDomain(entry.id)} class="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">
              Verify DNS
            </button>
          </div>
        )}
      </For>

      <Show when={!loading() && domains().length === 0}>
        <p class="text-center text-gray-500 py-6">No domains configured.</p>
      </Show>
    </div>
  );
}
