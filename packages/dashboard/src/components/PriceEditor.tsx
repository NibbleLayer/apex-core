import { createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../api/client';
import { buildCreatePricePayload } from '../api/payloads';
import type { PriceRule } from '../api/types';
import {
  formatPricingTokenLabel,
  normalizeUsdAmountInput,
  PRICING_TOKEN_PRESETS,
  type PricingTokenPresetId,
} from '../utils/pricing';

interface PriceEditorProps {
  routeId: string;
  onRefresh: () => void;
}

export function PriceEditor(props: PriceEditorProps) {
  const [pricing, setPricing] = createSignal<PriceRule[]>([]);
  const [showForm, setShowForm] = createSignal(false);
  const [showAdvancedFields, setShowAdvancedFields] = createSignal(false);
  const [amount, setAmount] = createSignal('');
  const [selectedPresetId, setSelectedPresetId] = createSignal<PricingTokenPresetId>('test-usdc-base-sepolia');
  const [rawToken, setRawToken] = createSignal('');
  const [rawNetwork, setRawNetwork] = createSignal('');
  const [error, setError] = createSignal('');

  const selectedPreset = () => PRICING_TOKEN_PRESETS.find((preset) => preset.id === selectedPresetId()) ?? PRICING_TOKEN_PRESETS[0];
  const resolvedToken = () => rawToken().trim() || selectedPreset().token;
  const resolvedNetwork = () => rawNetwork().trim() || selectedPreset().network;

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
    const normalizedAmount = normalizeUsdAmountInput(amount());
    if (!normalizedAmount) {
      setError('Enter a positive USD price amount before saving.');
      return;
    }

    if (!resolvedToken()) {
      setError('Select a token preset or enter a token address in advanced fields.');
      return;
    }

    if (!resolvedNetwork()) {
      setError('Select a token preset or enter a CAIP network in advanced fields.');
      return;
    }

    try {
      await api.createPrice(
        props.routeId,
        buildCreatePricePayload({ amount: normalizedAmount, token: resolvedToken(), network: resolvedNetwork() }),
      );
      setShowForm(false);
      setShowAdvancedFields(false);
      setAmount('');
      setRawToken('');
      setRawNetwork('');
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
                  <span class="text-gray-500 text-xs">{formatPricingTokenLabel(price.token, price.network)}</span>
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
            <div>
              <label for="price-usd" class="block text-xs font-medium text-gray-600 mb-1">Price (USD)</label>
              <input
                id="price-usd"
                type="text"
                value={amount()}
                onInput={(e) => setAmount(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm"
                placeholder="0.01"
              />
            </div>
            <div>
              <label for="price-token-preset" class="block text-xs font-medium text-gray-600 mb-1">Token preset</label>
              <select
                id="price-token-preset"
                value={selectedPresetId()}
                onChange={(e) => setSelectedPresetId(e.currentTarget.value as PricingTokenPresetId)}
                class="w-full px-3 py-1.5 border rounded text-sm"
              >
                <For each={PRICING_TOKEN_PRESETS}>
                  {(preset) => <option value={preset.id}>{preset.label}</option>}
                </For>
              </select>
            </div>
            <div class="col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFields((current) => !current)}
                class="text-xs text-blue-600 hover:underline"
              >
                {showAdvancedFields() ? 'Hide advanced fields' : 'Show advanced fields'}
              </button>
            </div>
            <Show when={showAdvancedFields()}>
              <div>
                <label for="raw-token-address" class="block text-xs font-medium text-gray-600 mb-1">Raw token address</label>
                <input
                  id="raw-token-address"
                  type="text"
                  value={rawToken()}
                  onInput={(e) => setRawToken(e.currentTarget.value)}
                  class="w-full px-3 py-1.5 border rounded text-sm font-mono"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label for="raw-caip-network" class="block text-xs font-medium text-gray-600 mb-1">Raw CAIP network</label>
                <input
                  id="raw-caip-network"
                  type="text"
                  value={rawNetwork()}
                  onInput={(e) => setRawNetwork(e.currentTarget.value)}
                  class="w-full px-3 py-1.5 border rounded text-sm font-mono"
                  placeholder="eip155:84532"
                />
              </div>
            </Show>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
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
