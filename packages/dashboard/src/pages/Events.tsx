import { createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../api/client';
import { formatDate, eventTypeColor } from '../utils/format';

const EVENT_TYPES = [
  'payment.required',
  'payment.verified',
  'payment.settled',
  'payment.failed',
  'payment.replay',
];

export default function Events() {
  const [events, setEvents] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [filterType, setFilterType] = createSignal('');
  const [services, setServices] = createSignal<any[]>([]);
  const [selectedService, setSelectedService] = createSignal('');

  async function loadServices() {
    try {
      const data = await api.listServices();
      setServices(data);
      if (data.length > 0 && !selectedService()) {
        setSelectedService(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    }
  }

  async function loadEvents() {
    const svcId = selectedService();
    if (!svcId) return;
    try {
      setLoading(true);
      let params = '';
      if (filterType()) params = `type=${filterType()}`;
      const data = await api.listEvents(svcId, params || undefined);
      setEvents(Array.isArray(data) ? data : data.events || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  onMount(async () => {
    await loadServices();
    if (selectedService()) loadEvents();
  });

  // Auto-refresh every 30 seconds
  onMount(() => {
    const timer = setInterval(() => {
      if (selectedService()) loadEvents();
    }, 30_000);
    return () => clearInterval(timer);
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Events</h1>
        <button
          onClick={loadEvents}
          class="text-sm text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div class="flex gap-3 mb-4">
        <select
          value={selectedService()}
          onChange={(e) => { setSelectedService(e.currentTarget.value); loadEvents(); }}
          class="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Select service...</option>
          <For each={services()}>
            {(svc) => <option value={svc.id}>{svc.name}</option>}
          </For>
        </select>
        <select
          value={filterType()}
          onChange={(e) => { setFilterType(e.currentTarget.value); loadEvents(); }}
          class="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All types</option>
          <For each={EVENT_TYPES}>
            {(type) => <option value={type}>{type}</option>}
          </For>
        </select>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error()}</div>
      </Show>

      <Show when={loading()}>
        <p class="text-gray-500">Loading events...</p>
      </Show>

      <Show when={!loading() && events().length === 0}>
        <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No events found. Events will appear here as payments are processed.
        </div>
      </Show>

      <div class="space-y-2">
        <For each={events()}>
          {(evt) => (
            <div class="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <span class={`text-xs px-2 py-1 rounded font-medium ${eventTypeColor(evt.type)}`}>
                    {evt.type}
                  </span>
                  <div>
                    <p class="text-sm text-gray-900 font-mono">{evt.request_id}</p>
                    <Show when={evt.payment_identifier}>
                      <p class="text-xs text-gray-500 font-mono">{evt.payment_identifier}</p>
                    </Show>
                  </div>
                </div>
                <span class="text-xs text-gray-400">{formatDate(evt.created_at)}</span>
              </div>
              <Show when={evt.buyer_address}>
                <p class="text-xs text-gray-400 mt-2 font-mono">From: {evt.buyer_address}</p>
              </Show>
              <Show when={evt.payload}>
                <details class="mt-2">
                  <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Payload</summary>
                  <pre class="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </details>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
