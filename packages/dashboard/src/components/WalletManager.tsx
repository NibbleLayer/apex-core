import { createEffect, createSignal, For, Show, onMount } from 'solid-js';
import { api } from '../api/client';
import { buildCreateWalletPayload } from '../api/payloads';
import type { Environment, WalletDestination } from '../api/types';
import { networkLabel } from '../utils/network';

interface WalletManagerProps {
  serviceId: string;
  environments: Environment[];
}

export function WalletManager(props: WalletManagerProps) {
  const [wallets, setWallets] = createSignal<WalletDestination[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [showCreate, setShowCreate] = createSignal(false);
  const [address, setAddress] = createSignal('');
  const [environmentId, setEnvironmentId] = createSignal('');
  const [token, setToken] = createSignal('');
  const [label, setLabel] = createSignal('');

  async function loadWallets() {
    try {
      setLoading(true);
      const data = await api.listWallets(props.serviceId);
      setWallets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }

  onMount(loadWallets);

  createEffect(() => {
    if (!environmentId() && props.environments.length > 0) {
      setEnvironmentId(props.environments[0].id);
    }
  });

  const selectedEnvironment = () => props.environments.find((environment) => environment.id === environmentId());

  async function handleCreate(e: Event) {
    e.preventDefault();
    try {
      const payload = buildCreateWalletPayload({
        environmentId: environmentId(),
        token: token(),
        network: selectedEnvironment()?.network ?? '',
      });

      await api.createWallet(props.serviceId, {
        environmentId: payload.environmentId,
        address: address(),
        token: payload.token,
        network: payload.network,
        label: label() || undefined,
      });
      setShowCreate(false);
      setAddress('');
      setToken('');
      setLabel('');
      loadWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    }
  }

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
          {showCreate() ? 'Cancel' : '+ Add Wallet'}
        </button>
      </div>

      <Show when={showCreate()}>
        <form onSubmit={handleCreate} class="bg-white p-4 rounded-lg shadow mb-4 space-y-3">
          <Show when={props.environments.length > 0} fallback={<p class="text-sm text-yellow-700">Create an environment before adding a wallet destination.</p>}>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Environment *</label>
              <select
                required
                value={environmentId()}
                onChange={(e) => setEnvironmentId(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <For each={props.environments}>
                  {(environment) => (
                    <option value={environment.id}>
                      {environment.mode} · {networkLabel(environment.network)}
                    </option>
                  )}
                </For>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Address *</label>
              <input
                type="text"
                required
                value={address()}
                onInput={(e) => setAddress(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                placeholder="0x..."
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Settlement Token *</label>
              <input
                type="text"
                required
                value={token()}
                onInput={(e) => setToken(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                placeholder="0x..."
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Network</label>
              <input
                type="text"
                value={selectedEnvironment() ? networkLabel(selectedEnvironment()!.network) : 'Select an environment'}
                disabled
                class="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input
                type="text"
                value={label()}
                onInput={(e) => setLabel(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Treasury"
              />
            </div>
          </div>
          </Show>
          <button
            type="submit"
            disabled={!address().trim() || !token().trim() || !selectedEnvironment()}
            class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Add Wallet
          </button>
        </form>
      </Show>

      <Show when={loading()}>
        <p class="text-gray-500">Loading wallets...</p>
      </Show>

      <Show when={!loading() && wallets().length === 0}>
        <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No wallets configured. Add a destination wallet for settlement payouts.
        </div>
      </Show>

      <div class="space-y-2">
        <For each={wallets()}>
          {(wallet) => (
            <div class="bg-white p-4 rounded-lg shadow flex items-center justify-between">
              <div>
                <p class="text-sm font-mono text-gray-900">{wallet.address}</p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-xs text-gray-500">{networkLabel(wallet.network)}</span>
                  <span class="text-xs text-gray-500 font-mono truncate max-w-[180px]">{wallet.token}</span>
                  <Show when={wallet.label}>
                    <span class="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{wallet.label}</span>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
