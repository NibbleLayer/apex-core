import { createSignal, onMount, Show } from 'solid-js';
import { api } from '../api/client';
import { buildDiscoveryPayload } from '../api/payloads';
import type { DiscoveryMetadata } from '../api/types';

interface DiscoveryEditorProps {
  routeId: string;
  serviceId: string;
}

export function DiscoveryEditor(props: DiscoveryEditorProps) {
  const [data, setData] = createSignal<DiscoveryMetadata | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');

  // Form fields
  const [discoverable, setDiscoverable] = createSignal(false);
  const [category, setCategory] = createSignal('');
  const [tags, setTags] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [mimeType, setMimeType] = createSignal('');
  const [docsUrl, setDocsUrl] = createSignal('');
  const [inputSchema, setInputSchema] = createSignal('{}');
  const [outputSchema, setOutputSchema] = createSignal('{}');
  const [published, setPublished] = createSignal(false);

  async function loadDiscovery() {
    try {
      setLoading(true);
      const result = await api.getDiscovery(props.routeId);
      setData(result);
      // Populate form
      setDiscoverable(result.discoverable);
      setCategory(result.category || '');
      setTags(result.tags?.join(', ') || '');
      setDescription(result.description || '');
      setMimeType(result.mimeType || '');
      setDocsUrl(result.docsUrl || '');
      setInputSchema(result.inputSchema ? JSON.stringify(result.inputSchema, null, 2) : '{}');
      setOutputSchema(result.outputSchema ? JSON.stringify(result.outputSchema, null, 2) : '{}');
      setPublished(result.published);
    } catch (err) {
      // 404 means no discovery config yet — that's fine
      const message = err instanceof Error ? err.message : '';
      if (!message.includes('404')) {
        setError(err instanceof Error ? err.message : 'Failed to load discovery');
      }
    } finally {
      setLoading(false);
    }
  }

  onMount(loadDiscovery);

  async function handleSave(e: Event) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = buildDiscoveryPayload({
        discoverable: discoverable(),
        category: category(),
        tags: tags(),
        description: description(),
        mimeType: mimeType(),
        docsUrl: docsUrl(),
        inputSchema: inputSchema(),
        outputSchema: outputSchema(),
        published: published(),
      });

      const hadExistingConfig = data() !== null;
      await api.createDiscovery(props.routeId, payload);
      if (!hadExistingConfig && payload.published) {
        await api.createDiscovery(props.routeId, payload);
      }
      setSuccess('Discovery metadata saved');
      loadDiscovery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="bg-white p-4 rounded-lg shadow">
      <Show when={loading()}>
        <p class="text-gray-500 text-sm">Loading discovery config...</p>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSave} class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            {/* Discoverable toggle */}
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={discoverable()}
                onChange={(e) => setDiscoverable(e.currentTarget.checked)}
                class="rounded"
              />
              <span class="font-medium text-gray-700">Discoverable</span>
            </label>

            {/* Published toggle */}
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={published()}
                onChange={(e) => setPublished(e.currentTarget.checked)}
                class="rounded"
              />
              <span class="font-medium text-gray-700">Published</span>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <input
                type="text"
                value={category()}
                onInput={(e) => setCategory(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm"
                placeholder="ai, data, finance..."
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags()}
                onInput={(e) => setTags(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm"
                placeholder="gpt, sentiment, analysis"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              class="w-full px-3 py-1.5 border rounded text-sm"
              rows={2}
              placeholder="Describe this API endpoint for Bazaar discovery..."
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">MIME Type</label>
              <input
                type="text"
                value={mimeType()}
                onInput={(e) => setMimeType(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm"
                placeholder="application/json"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Docs URL</label>
              <input
                type="url"
                value={docsUrl()}
                onInput={(e) => setDocsUrl(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm"
                placeholder="https://docs.example.com/api"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Input Schema (JSON)</label>
              <textarea
                value={inputSchema()}
                onInput={(e) => setInputSchema(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm font-mono"
                rows={4}
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Output Schema (JSON)</label>
              <textarea
                value={outputSchema()}
                onInput={(e) => setOutputSchema(e.currentTarget.value)}
                class="w-full px-3 py-1.5 border rounded text-sm font-mono"
                rows={4}
              />
            </div>
          </div>

          <Show when={error()}>
            <p class="text-red-600 text-sm">{error()}</p>
          </Show>
          <Show when={success()}>
            <p class="text-green-600 text-sm">{success()}</p>
          </Show>

          <button
            type="submit"
            disabled={saving()}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving() ? 'Saving...' : 'Save Discovery Config'}
          </button>
        </form>
      </Show>
    </div>
  );
}
