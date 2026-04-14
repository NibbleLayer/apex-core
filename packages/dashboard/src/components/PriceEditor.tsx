import { createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../api/client';
import { buildCreatePricePayload } from '../api/payloads';
import type { PriceRule } from '../api/types';
import { networkLabel } from '../utils/network';

interface PriceEditorProps {
  routeId: string;
  onRefresh: () => void;
}

export function PriceEditor(props: PriceEditorProps) {
  const [pricing, setPricing] = createSignal<PriceRule[]>([]);
  const [showForm, setShowForm] = createSignal(false);
  const [amount, setAmount] = createSignal('');
  const [token, setToken] = createSignal('');
  const [network, setNetwork] = createSignal('eip155:84532');
  const [error, setError] = createSignal('');

  async function loadPricing() {
    try {
      setPricing(await api.listPricing(props.routeId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing');
    }
  }

  onMount(loadPricing);

  async function createPrice(e: Event) {
    e.preventDefault();
    try {
      await api.createPrice(props.routeId, buildCreatePricePayload({ amount: amount(), token: token(), network: network() }));
      setShowForm(false);
      setAmount('');
      setToken('');
      await loadPricing();
      props.onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create price');
    }
  }

  return (
    <div>
      <h4 class="text-sm font-medium text-gray-700 mb-3">Pricing Rules</h4>

      <Show when={error()}>
        <p class="text-red-600 text-xs mb-2">{error()}</p>
      </Show>

      <Show when={pricing().length > 0}>
        <div class="space-y-2 mb-4">
          <For each={pricing()}>
            {(price) => (
              <div class="flex items-center justify-between bg-white p-3 rounded border text-sm">
                <div class="flex items-center gap-4">
                  <span class={`px-2 py-0.5 rounded text-xs ${price.active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                    {price.scheme}
                  </span>
                  <span class="font-medium text-gray-900">{price.amount}</span>
                  <span class="text-gray-500 text-xs font-mono truncate max-w-[150px]">{price.token}</span>
                  <span class="text-gray-500 text-xs">{networkLabel(price.network)}</span>
                </div>
                <span class={`w-2 h-2 rounded-full ${price.active ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={pricing().length === 0}>
        <p class="text-gray-500 text-sm mb-3">No pricing rules. Add one to monetize this route.</p>
      </Show>

      <Show when={!showForm()}>
        <button
          onClick={() => setShowForm(true)}
          class="text-sm text-blue-600 hover:underline"
        >
          + Add Price Rule
        </button>
      </Show>

      <Show when={showForm()}>
        <form onSubmit={createPrice} class="bg-white p-4 rounded border space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-1">Scheme</label>
              <input
                type="text"
                value="Exact"
                disabled
                class="w-full px-3 py-1.5 border rounded text-sm bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
              <input
                type="text"
                required
                value={amount()}
                onInput={(e) => setAmount(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm"
                placeholder="$0.01"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Token Address *</label>
              <input
                type="text"
                required
                value={token()}
                onInput={(e) => setToken(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm font-mono"
                placeholder="0x..."
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Network</label>
              <select
                value={network()}
                onChange={(e) => setNetwork(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm"
              >
                <option value="eip155:84532">Base Sepolia</option>
                <option value="eip155:8453">Base</option>
                <option value="eip155:1">Ethereum</option>
                <option value="eip155:11155111">Sepolia</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              disabled={!amount().trim() || !token().trim()}
              class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </Show>
    </div>
  );
}
