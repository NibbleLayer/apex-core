import { createSignal, For, Show } from 'solid-js';
import { api } from '../api/client';
import type { Route } from '../api/types';
import { PriceEditor } from './PriceEditor';

interface RouteTableProps {
  serviceId: string;
  routes: Route[];
  onRefresh: () => void;
}

export function RouteTable(props: RouteTableProps) {
  const [expandedRoute, setExpandedRoute] = createSignal<string | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);
  const [newMethod, setNewMethod] = createSignal('GET');
  const [newPath, setNewPath] = createSignal('');
  const [newDesc, setNewDesc] = createSignal('');
  const [error, setError] = createSignal('');

  async function toggleRoute(route: Route) {
    try {
      await api.updateRoute(route.id, { enabled: !route.enabled });
      props.onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update route');
    }
  }

  async function createRoute(e: Event) {
    e.preventDefault();
    try {
      await api.createRoute(props.serviceId, {
        method: newMethod(),
        path: newPath(),
        description: newDesc() || undefined,
      });
      setShowCreate(false);
      setNewPath('');
      setNewDesc('');
      props.onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create route');
    }
  }

  const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-green-50 text-green-700',
    POST: 'bg-blue-50 text-blue-700',
    PUT: 'bg-yellow-50 text-yellow-700',
    PATCH: 'bg-orange-50 text-orange-700',
    DELETE: 'bg-red-50 text-red-700',
  };

  return (
    <div>
      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error()}</div>
      </Show>

      <div class="flex justify-end mb-4">
        <button
          onClick={() => setShowCreate(!showCreate())}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showCreate() ? 'Cancel' : '+ New Route'}
        </button>
      </div>

      <Show when={showCreate()}>
        <form onSubmit={createRoute} class="bg-white p-4 rounded-lg shadow mb-4">
          <div class="flex gap-3 items-end">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Method</label>
              <select
                value={newMethod()}
                onChange={(e) => setNewMethod(e.currentTarget.value)}
                class="px-3 py-2 border rounded-lg text-sm"
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-600 mb-1">Path *</label>
              <input
                type="text"
                required
                value={newPath()}
                onInput={(e) => setNewPath(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="/v1/resource"
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={newDesc()}
                onInput={(e) => setNewDesc(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!newPath().trim()}
              class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      </Show>

      <Show when={props.routes.length === 0}>
        <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No routes defined. Create your first route above.
        </div>
      </Show>

      <div class="space-y-2">
        <For each={props.routes}>
          {(route) => (
            <div class="bg-white rounded-lg shadow">
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <span class={`text-xs font-mono px-2 py-1 rounded ${METHOD_COLORS[route.method] || 'bg-gray-50 text-gray-700'}`}>
                    {route.method}
                  </span>
                  <span class="font-mono text-sm text-gray-900">{route.path}</span>
                  <Show when={route.description}>
                    <span class="text-sm text-gray-500">— {route.description}</span>
                  </Show>
                </div>
                <div class="flex items-center gap-3">
                  <Show when={route.pricing && route.pricing.length > 0}>
                    <span class="text-xs text-gray-500">{route.pricing!.length} price(s)</span>
                  </Show>
                  <button
                    onClick={() => setExpandedRoute(expandedRoute() === route.id ? null : route.id)}
                    class="text-xs text-blue-600 hover:underline"
                  >
                    {expandedRoute() === route.id ? 'Collapse' : 'Pricing'}
                  </button>
                  <button
                    onClick={() => toggleRoute(route)}
                    class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      route.enabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      class={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        route.enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <Show when={expandedRoute() === route.id}>
                <div class="border-t p-4 bg-gray-50">
                  <PriceEditor
                    routeId={route.id}
                    onRefresh={props.onRefresh}
                  />
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
