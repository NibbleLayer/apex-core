import { createSignal, onMount, Show, For } from 'solid-js';
import { useParams } from '@solidjs/router';
import { api } from '../api/client';
import type { Service, Environment, Route } from '../api/types';
import { buildCreateEnvironmentPayload } from '../api/payloads';
import { RouteTable } from '../components/RouteTable';
import { WalletManager } from '../components/WalletManager';
import { PriceEditor } from '../components/PriceEditor';
import { DiscoveryEditor } from '../components/DiscoveryEditor';
import { WebhookManager } from '../components/WebhookManager';
import { networkLabel } from '../utils/network';
import { formatDate } from '../utils/format';

type Tab = 'routes' | 'environments' | 'wallets' | 'events' | 'settlements' | 'discovery' | 'webhooks' | 'manifest';

function CreateEnvironmentForm(props: { serviceId: string; onCreated: () => Promise<void> | void }) {
  const [mode, setMode] = createSignal<'test' | 'prod'>('test');
  const [network, setNetwork] = createSignal('eip155:84532');
  const [facilitatorUrl, setFacilitatorUrl] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.createEnvironment(
        props.serviceId,
        buildCreateEnvironmentPayload({
          mode: mode(),
          network: network(),
          facilitatorUrl: facilitatorUrl(),
        }),
      );

      setFacilitatorUrl('');
      await props.onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create environment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="bg-white p-4 rounded-lg shadow mb-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Mode</label>
          <select
            value={mode()}
            onChange={(e) => {
              const nextMode = e.currentTarget.value as 'test' | 'prod';
              setMode(nextMode);
              setNetwork(nextMode === 'prod' ? 'eip155:8453' : 'eip155:84532');
            }}
            class="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="test">Test</option>
            <option value="prod">Production</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Network</label>
          <select
            value={network()}
            onChange={(e) => setNetwork(e.currentTarget.value)}
            class="w-full px-3 py-2 border rounded-lg text-sm"
          >
            <option value="eip155:84532">Base Sepolia</option>
            <option value="eip155:8453">Base</option>
            <option value="eip155:11155111">Sepolia</option>
            <option value="eip155:1">Ethereum</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Facilitator URL</label>
          <input
            type="url"
            value={facilitatorUrl()}
            onInput={(e) => setFacilitatorUrl(e.currentTarget.value)}
            class="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Leave blank to use API default"
          />
        </div>
      </div>
      <Show when={error()}>
        <p class="text-sm text-red-600">{error()}</p>
      </Show>
      <button
        type="submit"
        disabled={saving()}
        class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
      >
        {saving() ? 'Creating...' : 'Create Environment'}
      </button>
    </form>
  );
}

export default function ServiceDetail() {
  const params = useParams();
  const [service, setService] = createSignal<Service | null>(null);
  const [environments, setEnvironments] = createSignal<Environment[]>([]);
  const [routes, setRoutes] = createSignal<Route[]>([]);
  const [events, setEvents] = createSignal<any>(null);
  const [settlements, setSettlements] = createSignal<any>(null);
  const [manifest, setManifest] = createSignal<any>(null);
  const [activeTab, setActiveTab] = createSignal<Tab>('routes');
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'routes', label: 'Routes' },
    { key: 'environments', label: 'Environments' },
    { key: 'wallets', label: 'Wallets' },
    { key: 'events', label: 'Events' },
    { key: 'settlements', label: 'Settlements' },
    { key: 'discovery', label: 'Discovery' },
    { key: 'webhooks', label: 'Webhooks' },
    { key: 'manifest', label: 'Manifest' },
  ];

  async function loadAll() {
    try {
      setLoading(true);
      const [svc, envs, rts] = await Promise.all([
        api.getService(params.id),
        api.listEnvironments(params.id),
        api.listRoutes(params.id),
      ]);
      setService(svc);
      setEnvironments(envs);
      setRoutes(rts);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service');
    } finally {
      setLoading(false);
    }
  }

  async function loadTabData(tab: Tab) {
    try {
      switch (tab) {
        case 'events':
          if (!events()) {
            const data = await api.listEvents(params.id);
            setEvents(data);
          }
          break;
        case 'settlements':
          if (!settlements()) {
            const data = await api.listSettlements(params.id);
            setSettlements(data);
          }
          break;
        case 'manifest':
          if (!manifest()) {
            const env = environments().find((e) => e.mode === 'prod') || environments()[0];
            if (env) {
              const data = await api.getManifest(params.id, env.mode);
              setManifest(data);
            }
          }
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }

  onMount(loadAll);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    loadTabData(tab);
  }

  async function copyManifest() {
    if (manifest()) {
      await navigator.clipboard.writeText(JSON.stringify(manifest(), null, 2));
    }
  }

  return (
    <div>
      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error()}</div>
      </Show>

      <Show when={loading()}>
        <p class="text-gray-500">Loading service...</p>
      </Show>

      <Show when={!loading() && service()}>
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">{service()!.name}</h1>
          <p class="text-gray-500">{service()!.slug}</p>
          <Show when={service()!.description}>
            <p class="text-gray-600 mt-1">{service()!.description}</p>
          </Show>
        </div>

        {/* Tabs */}
        <div class="border-b mb-6">
          <nav class="flex gap-1 overflow-x-auto">
            <For each={TABS}>
              {(tab) => (
                <button
                  onClick={() => switchTab(tab.key)}
                  class={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab() === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </nav>
        </div>

        {/* Tab content */}
        <Show when={activeTab() === 'routes'}>
          <RouteTable
            serviceId={params.id}
            routes={routes()}
            onRefresh={loadAll}
          />
        </Show>

        <Show when={activeTab() === 'environments'}>
          <CreateEnvironmentForm serviceId={params.id} onCreated={loadAll} />
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Facilitator URL</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <For each={environments()}>
                  {(env) => (
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-3">
                        <span class={`text-xs px-2 py-1 rounded ${env.mode === 'prod' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {env.mode}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-900">{networkLabel(env.network)}</td>
                      <td class="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-xs">{env.facilitatorUrl}</td>
                      <td class="px-4 py-3 text-sm text-gray-500">{formatDate(env.createdAt)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
            <Show when={environments().length === 0}>
              <p class="p-6 text-center text-gray-500">No environments configured.</p>
            </Show>
          </div>
        </Show>

        <Show when={activeTab() === 'wallets'}>
          <WalletManager serviceId={params.id} environments={environments()} />
        </Show>

        <Show when={activeTab() === 'events'}>
          <Show when={events()}>
            <div class="space-y-3">
              <For each={events()?.events || []}>
                 {(evt: any) => (
                   <div class="bg-white p-4 rounded-lg shadow flex items-start justify-between">
                     <div>
                       <span class={`text-xs px-2 py-1 rounded ${evt.type === 'payment.settled' ? 'bg-green-50 text-green-700' : evt.type === 'payment.failed' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                         {evt.type}
                       </span>
                       <p class="text-sm text-gray-600 mt-2">Request: {evt.request_id}</p>
                     </div>
                     <span class="text-xs text-gray-400">{formatDate(evt.created_at)}</span>
                   </div>
                 )}
               </For>
               <Show when={events() && (events()?.events?.length ?? 0) === 0}>
                 <p class="text-center text-gray-500 py-8">No events found.</p>
               </Show>
            </div>
          </Show>
        </Show>

        <Show when={activeTab() === 'settlements'}>
          <Show when={settlements()}>
            <div class="bg-white rounded-lg shadow overflow-hidden">
              <table class="w-full">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Network</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <For each={settlements()?.settlements || []}>
                    {(s: any) => (
                      <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm text-gray-500">{formatDate(s.created_at)}</td>
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">{s.amount}</td>
                        <td class="px-4 py-3 text-sm text-gray-600 font-mono truncate max-w-[200px]">{s.token}</td>
                        <td class="px-4 py-3 text-sm text-gray-600">{networkLabel(s.network)}</td>
                        <td class="px-4 py-3">
                          <span class={`text-xs px-2 py-1 rounded ${
                            s.status === 'confirmed' ? 'bg-green-50 text-green-700' :
                            s.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-[200px]">{s.settlement_reference || '—'}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>

        <Show when={activeTab() === 'discovery'}>
          <For each={routes()}>
            {(route) => (
              <div class="mb-6">
                <h3 class="text-sm font-medium text-gray-700 mb-2">
                  {route.method} {route.path}
                </h3>
                <DiscoveryEditor routeId={route.id} serviceId={params.id} />
              </div>
            )}
          </For>
          <Show when={routes().length === 0}>
            <p class="text-gray-500">Create routes first to configure discovery metadata.</p>
          </Show>
        </Show>

        <Show when={activeTab() === 'webhooks'}>
          <WebhookManager serviceId={params.id} />
        </Show>

        <Show when={activeTab() === 'manifest'}>
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-gray-900">Service Manifest</h3>
              <button
                onClick={copyManifest}
                class="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Copy JSON
              </button>
            </div>
            <Show when={manifest()}>
              <pre class="bg-gray-50 p-4 rounded overflow-x-auto text-sm text-gray-800">
                {JSON.stringify(manifest(), null, 2)}
              </pre>
            </Show>
            <Show when={!manifest()}>
              <p class="text-gray-500">No manifest available. Ensure the service has environments configured.</p>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
}
