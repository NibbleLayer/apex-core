import { createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../api/client';
import { formatDate, formatAmount, settlementStatusColor } from '../utils/format';
import { networkLabel } from '../utils/network';

export default function Settlements() {
  const [settlements, setSettlements] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
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

  async function loadSettlements() {
    const svcId = selectedService();
    if (!svcId) return;
    try {
      setLoading(true);
      const data = await api.listSettlements(svcId);
      setSettlements(Array.isArray(data) ? data : data.settlements || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }

  onMount(async () => {
    await loadServices();
    if (selectedService()) loadSettlements();
  });

  // Auto-refresh every 30 seconds
  onMount(() => {
    const timer = setInterval(() => {
      if (selectedService()) loadSettlements();
    }, 30_000);
    return () => clearInterval(timer);
  });

  function totalAmount(): string {
    const confirmed = settlements().filter((s) => s.status === 'confirmed');
    const sum = confirmed.reduce((acc, s) => {
      const val = parseFloat(s.amount?.replace('$', '') || '0');
      return acc + val;
    }, 0);
    return `$${sum.toFixed(2)}`;
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Settlements</h1>
        <div class="flex items-center gap-4">
          <Show when={settlements().length > 0}>
            <span class="text-sm text-gray-500">
              Total confirmed: <span class="font-semibold text-green-700">{totalAmount()}</span>
            </span>
          </Show>
          <button
            onClick={loadSettlements}
            class="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Service selector */}
      <div class="mb-4">
        <select
          value={selectedService()}
          onChange={(e) => { setSelectedService(e.currentTarget.value); loadSettlements(); }}
          class="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Select service...</option>
          <For each={services()}>
            {(svc) => <option value={svc.id}>{svc.name}</option>}
          </For>
        </select>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error()}</div>
      </Show>

      <Show when={loading()}>
        <p class="text-gray-500">Loading settlements...</p>
      </Show>

      <Show when={!loading() && settlements().length === 0}>
        <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No settlements found. Settlements appear after confirmed payments.
        </div>
      </Show>

      <Show when={!loading() && settlements().length > 0}>
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">TX Reference</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <For each={settlements()}>
                {(s) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm text-gray-500">{formatDate(s.createdAt)}</td>
                    <td class="px-4 py-3 text-sm font-medium text-gray-900">{formatAmount(s.amount)}</td>
                    <td class="px-4 py-3 text-sm text-gray-600 font-mono truncate max-w-[200px]">{s.token || '—'}</td>
                    <td class="px-4 py-3 text-sm text-gray-600">{networkLabel(s.network)}</td>
                    <td class="px-4 py-3">
                      <span class={`text-xs px-2 py-1 rounded font-medium ${settlementStatusColor(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-[200px]">
                      {s.settlementReference || '—'}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}
