import { createSignal, For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api } from '../api/client';
import { formatDate, formatAmount, eventTypeColor } from '../utils/format';
import type { Service, PaymentEvent } from '../api/types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [services, setServices] = createSignal<Service[]>([]);
  const [recentEvents, setRecentEvents] = createSignal<PaymentEvent[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  async function loadDashboard() {
    try {
      setLoading(true);
      const svcData = await api.listServices();
      setServices(svcData);

      // Load recent events from first service (if any)
      if (svcData.length > 0) {
        try {
          const evtData = await api.listEvents(svcData[0].id, 'limit=10');
          const items = Array.isArray(evtData) ? evtData : evtData.events || [];
          setRecentEvents(items);
        } catch {
          // Events may fail — non-critical for overview
        }
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  onMount(loadDashboard);

  // Auto-refresh every 30 seconds
  onMount(() => {
    const timer = setInterval(loadDashboard, 30_000);
    return () => clearInterval(timer);
  });

  const totalRoutes = () =>
    services().reduce((sum, s) => sum + (s.routes?.length || 0), 0);

  const totalEventsToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    return recentEvents().filter((e) => e.createdAt?.startsWith(today)).length;
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={loadDashboard}
          class="text-sm text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error()}</div>
      </Show>

      {/* Summary cards */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <p class="text-sm font-medium text-gray-500 uppercase">Active Services</p>
          <p class="text-3xl font-bold text-gray-900 mt-2">{services().length}</p>
          <p class="text-sm text-gray-400 mt-1">{totalRoutes()} total routes</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <p class="text-sm font-medium text-gray-500 uppercase">Events Today</p>
          <p class="text-3xl font-bold text-blue-600 mt-2">{totalEventsToday()}</p>
          <p class="text-sm text-gray-400 mt-1">Across all services</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
          <p class="text-sm font-medium text-gray-500 uppercase">Quick Actions</p>
          <div class="mt-3 space-y-2">
            <button
              onClick={() => navigate('/services')}
              class="w-full text-left text-sm px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              + Create Service
            </button>
            <button
              onClick={() => navigate('/events')}
              class="w-full text-left text-sm px-3 py-2 bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
            >
              View All Events
            </button>
          </div>
        </div>
      </div>

      {/* Services overview */}
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Services</h2>

        <Show when={loading()}>
          <p class="text-gray-500">Loading...</p>
        </Show>

        <Show when={!loading() && services().length === 0}>
          <div class="bg-white rounded-lg shadow p-8 text-center">
            <p class="text-gray-500 mb-4">No services yet. Create your first service to start accepting payments.</p>
            <button
              onClick={() => navigate('/services')}
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Create Service
            </button>
          </div>
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={services()}>
            {(service) => (
              <div
                class="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/services/${service.id}`)}
              >
                <div class="flex items-center justify-between">
                  <h3 class="font-semibold text-gray-900">{service.name}</h3>
                  <Show when={service.environments}>
                    <span class="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded">
                      {service.environments!.length} env{service.environments!.length !== 1 ? 's' : ''}
                    </span>
                  </Show>
                </div>
                <p class="text-sm text-gray-500 mt-1">{service.slug}</p>
                <Show when={service.routes}>
                  <p class="text-sm text-gray-400 mt-2">
                    {service.routes!.length} route{service.routes!.length !== 1 ? 's' : ''}
                  </p>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Recent events */}
      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Recent Events</h2>

        <Show when={recentEvents().length === 0 && !loading()}>
          <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No recent events. Events will appear here as payments are processed.
          </div>
        </Show>

        <div class="space-y-2">
          <For each={recentEvents().slice(0, 10)}>
            {(evt) => (
              <div class="bg-white p-4 rounded-lg shadow flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class={`text-xs px-2 py-1 rounded ${eventTypeColor(evt.type)}`}>
                    {evt.type}
                  </span>
                  <span class="text-sm font-mono text-gray-600">{evt.requestId}</span>
                </div>
                <span class="text-xs text-gray-400">{formatDate(evt.createdAt)}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
