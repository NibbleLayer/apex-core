import { createMemo, createSignal, For, Show } from 'solid-js';
import { api, getMaskedAdminApiKey } from '../api/client';
import type { Environment, SdkTokenCreateResponse } from '../api/types';

type SetupMode = 'test' | 'prod';

interface Preset {
  network: string;
  facilitatorUrl: string;
  tokenLabel: string;
  tokenAddress: string;
  description: string;
}

interface OnboardingWizardProps {
  serviceId: string;
  environments: Environment[];
  onRefresh: () => Promise<void> | void;
}

const PRESETS: Record<SetupMode, Preset> = {
  test: {
    network: 'eip155:84532',
    facilitatorUrl: 'https://x402.org/facilitator',
    tokenLabel: 'USDC test preset',
    tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    description: 'Use Base Sepolia and test USDC for local development and validation.',
  },
  prod: {
    network: 'eip155:8453',
    facilitatorUrl: 'https://x402.org/facilitator',
    tokenLabel: 'USDC on Base',
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    description: 'Use Base mainnet and production USDC for live customers.',
  },
};

export function deriveApexApiBaseUrl(origin = window.location.origin): string {
  return new URL('/api', origin).toString().replace(/\/$/, '');
}

function copyText(value: string): Promise<void> | void {
  if (!navigator.clipboard) return;
  return navigator.clipboard.writeText(value);
}

export function OnboardingWizard(props: OnboardingWizardProps) {
  const [mode, setMode] = createSignal<SetupMode>('test');
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [network, setNetwork] = createSignal(PRESETS.test.network);
  const [facilitatorUrl, setFacilitatorUrl] = createSignal(PRESETS.test.facilitatorUrl);
  const [tokenAddress, setTokenAddress] = createSignal(PRESETS.test.tokenAddress);
  const [walletAddress, setWalletAddress] = createSignal('');
  const [sdkToken, setSdkToken] = createSignal<SdkTokenCreateResponse | null>(null);
  const [busyAction, setBusyAction] = createSignal<'environment' | 'wallet' | 'sdk' | null>(null);
  const [error, setError] = createSignal('');

  const preset = () => PRESETS[mode()];
  const selectedEnvironment = createMemo(() => props.environments.find((environment) => environment.mode === mode()));
  const maskedAdminKey = () => getMaskedAdminApiKey();
  const sdkEnvSnippet = () => {
    const token = sdkToken()?.token;
    if (!token) return '';
    return `export APEX_TOKEN="${token}"\nexport APEX_URL="${deriveApexApiBaseUrl()}"`;
  };

  function selectMode(nextMode: SetupMode) {
    setMode(nextMode);
    setNetwork(PRESETS[nextMode].network);
    setFacilitatorUrl(PRESETS[nextMode].facilitatorUrl);
    setTokenAddress(PRESETS[nextMode].tokenAddress);
    setSdkToken(null);
    setError('');
  }

  async function createEnvironment() {
    setError('');
    const trimmedNetwork = network().trim();
    const trimmedFacilitatorUrl = facilitatorUrl().trim();

    if (!trimmedNetwork) {
      setError('Select or enter a network before creating the environment.');
      return;
    }

    setBusyAction('environment');
    try {
      await api.createEnvironment(props.serviceId, {
        mode: mode(),
        network: trimmedNetwork,
        ...(trimmedFacilitatorUrl ? { facilitatorUrl: trimmedFacilitatorUrl } : {}),
      });
      await props.onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create the environment failed. Check network and facilitator URL, then try again.');
    } finally {
      setBusyAction(null);
    }
  }

  async function createWallet() {
    setError('');
    const environment = selectedEnvironment();
    const address = walletAddress().trim();

    if (!environment) {
      setError(`Create the ${mode()} environment before adding a wallet destination.`);
      return;
    }
    if (!address || !address.startsWith('0x')) {
      setError('Enter a wallet address starting with 0x before creating a wallet destination.');
      return;
    }
    if (!tokenAddress().trim()) {
      setError('Select or enter a settlement token address before creating a wallet destination.');
      return;
    }

    setBusyAction('wallet');
    try {
      await api.createWallet(props.serviceId, {
        environmentId: environment.id,
        address,
        token: tokenAddress().trim(),
        network: network().trim(),
        label: `${preset().tokenLabel} settlement`,
      });
      await props.onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create the wallet destination failed. Confirm the address, token, and selected environment.');
    } finally {
      setBusyAction(null);
    }
  }

  async function createSdkToken() {
    setError('');
    if (!selectedEnvironment()) {
      setError(`Create the ${mode()} environment before creating an SDK token.`);
      return;
    }

    setBusyAction('sdk');
    try {
      const response = await api.createSdkToken(props.serviceId, {
        environment: mode(),
        label: 'Dashboard SDK',
        scopes: ['manifest:read', 'events:write', 'routes:register'],
      });
      setSdkToken(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create the SDK token failed. Confirm the environment exists and try again.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section class="space-y-4">
      <div class="bg-white rounded-lg shadow p-5 space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Service setup</h2>
          <p class="text-sm text-gray-600 mt-1">Configure an environment, settlement wallet, and scoped SDK token from the dashboard.</p>
        </div>

        <div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
          <Show when={maskedAdminKey()} fallback={<span>Add an admin API key on the login screen to manage this service. It is never included in SDK snippets.</span>}>
            <span>Admin API key present in this browser: <span class="font-mono">{maskedAdminKey()}</span>. It stays local and is not used in the app snippet.</span>
          </Show>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Setup path">
          <For each={(['test', 'prod'] as SetupMode[])}>
            {(setupMode) => (
              <button
                type="button"
                onClick={() => selectMode(setupMode)}
                class={`text-left border rounded-lg p-4 transition-colors ${mode() === setupMode ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                aria-pressed={mode() === setupMode}
              >
                <div class="font-medium text-gray-900">{setupMode === 'test' ? 'Test setup' : 'Production setup'}</div>
                <p class="text-sm text-gray-600 mt-1">{PRESETS[setupMode].description}</p>
              </button>
            )}
          </For>
        </div>

        <div class="rounded-lg border border-gray-200 p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-gray-900">Preset</p>
              <p class="text-sm text-gray-600">{preset().tokenLabel} · {network()} · {facilitatorUrl()}</p>
              <p class="text-xs text-gray-500 mt-1">Token address is hidden by default to keep setup approachable.</p>
            </div>
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced())} class="text-sm text-blue-600 hover:text-blue-700">
              {showAdvanced() ? 'Hide advanced fields' : 'Show advanced fields'}
            </button>
          </div>

          <Show when={showAdvanced()}>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label class="block text-xs font-medium text-gray-600">
                Network
                <input value={network()} onInput={(event) => setNetwork(event.currentTarget.value)} class="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              </label>
              <label class="block text-xs font-medium text-gray-600">
                Facilitator URL
                <input type="url" value={facilitatorUrl()} onInput={(event) => setFacilitatorUrl(event.currentTarget.value)} class="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              </label>
              <label class="block text-xs font-medium text-gray-600">
                Settlement token address
                <input value={tokenAddress()} onInput={(event) => setTokenAddress(event.currentTarget.value)} class="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              </label>
            </div>
          </Show>
        </div>
      </div>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error()}</div>
      </Show>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white rounded-lg shadow p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-gray-900">1. Environment setup</h3>
            <Show when={selectedEnvironment()}><span class="text-xs px-2 py-1 rounded bg-green-50 text-green-700">Completed</span></Show>
          </div>
          <p class="text-sm text-gray-600">Create the {mode()} environment with the selected preset.</p>
          <button type="button" onClick={createEnvironment} disabled={!!selectedEnvironment() || busyAction() === 'environment'} class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            {busyAction() === 'environment' ? 'Creating...' : selectedEnvironment() ? 'Environment ready' : `Create ${mode()} environment`}
          </button>
        </div>

        <div class="bg-white rounded-lg shadow p-5 space-y-3">
          <h3 class="font-semibold text-gray-900">2. Wallet setup</h3>
          <p class="text-sm text-gray-600">Add the settlement wallet that receives payments for {preset().tokenLabel}.</p>
          <input value={walletAddress()} onInput={(event) => setWalletAddress(event.currentTarget.value)} placeholder="0x..." class="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
          <Show when={!selectedEnvironment()}><p class="text-xs text-yellow-700">Create the {mode()} environment before creating a wallet destination.</p></Show>
          <button type="button" onClick={createWallet} disabled={!selectedEnvironment() || busyAction() === 'wallet'} class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            {busyAction() === 'wallet' ? 'Creating...' : 'Create wallet destination'}
          </button>
        </div>

        <div class="bg-white rounded-lg shadow p-5 space-y-3">
          <h3 class="font-semibold text-gray-900">3. SDK token</h3>
          <p class="text-sm text-gray-600">Create a scoped token for apex() with manifest read, event write, and route registration access.</p>
          <Show when={!selectedEnvironment()}><p class="text-xs text-yellow-700">Create the {mode()} environment before creating an SDK token.</p></Show>
          <button type="button" onClick={createSdkToken} disabled={!selectedEnvironment() || busyAction() === 'sdk'} class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {busyAction() === 'sdk' ? 'Creating...' : 'Create SDK token'}
          </button>
          <Show when={sdkToken()}>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-900">
              Copy this token now. It is displayed only once.
              <pre class="mt-2 whitespace-pre-wrap break-all font-mono text-xs">{sdkToken()!.token}</pre>
            </div>
          </Show>
        </div>

        <div class="bg-white rounded-lg shadow p-5 space-y-3">
          <h3 class="font-semibold text-gray-900">4. Integration snippet</h3>
          <Show when={sdkToken()} fallback={<p class="text-sm text-gray-600">Create an SDK token to generate the APEX_TOKEN and APEX_URL snippet.</p>}>
            <div class="space-y-3">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <p class="text-sm font-medium text-gray-700">Environment</p>
                  <button type="button" onClick={() => copyText(sdkEnvSnippet())} class="text-sm text-blue-600 hover:text-blue-700">Copy</button>
                </div>
                <pre class="bg-gray-50 p-3 rounded overflow-x-auto text-sm text-gray-800">{sdkEnvSnippet()}</pre>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-700 mb-1">Hono</p>
                <pre class="bg-gray-50 p-3 rounded overflow-x-auto text-sm text-gray-800">{`import { apex } from '@nibblelayer/apex-hono';\napp.use(apex());`}</pre>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </section>
  );
}
