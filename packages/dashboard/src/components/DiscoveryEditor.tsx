import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { api } from '../api/client';
import { buildDiscoveryPayload } from '../api/payloads';
import type { DiscoveryMetadata, DiscoveryPreviewResponse, DiscoveryQualityCheck } from '../api/types';

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
  const [serverPreview, setServerPreview] = createSignal<DiscoveryPreviewResponse | null>(null);

  // Form fields
  const [discoverable, setDiscoverable] = createSignal(false);
  const [category, setCategory] = createSignal('');
  const [tags, setTags] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [mimeType, setMimeType] = createSignal('');
  const [docsUrl, setDocsUrl] = createSignal('');
  const [inputSchema, setInputSchema] = createSignal('{}');
  const [outputSchema, setOutputSchema] = createSignal('{}');
  const [reviewStatus, setReviewStatus] = createSignal<'draft' | 'in_review' | 'published' | 'rejected'>('draft');
  const [indexingStatus, setIndexingStatus] = createSignal<'not_submitted' | 'queued' | 'indexed' | 'failed'>('not_submitted');
  const [indexingError, setIndexingError] = createSignal('');

  const qualityChecks = createMemo<DiscoveryQualityCheck[]>(() => {
    const checks: DiscoveryQualityCheck[] = [];
    const parsedTags = tags().split(',').map((tag) => tag.trim()).filter(Boolean);
    const descriptionValue = description().trim();

    if (!descriptionValue) checks.push({ level: 'error', message: 'Description is required before publishing.' });
    if (!category().trim()) checks.push({ level: 'error', message: 'Category is required before publishing.' });
    if (!mimeType().trim()) checks.push({ level: 'error', message: 'MIME type is required before publishing.' });
    if (inputSchema().trim() === '{}' || !inputSchema().trim()) checks.push({ level: 'error', message: 'Input schema is required before publishing.' });
    if (outputSchema().trim() === '{}' || !outputSchema().trim()) checks.push({ level: 'error', message: 'Output schema is required before publishing.' });
    if (!discoverable()) checks.push({ level: 'error', message: 'Route must be discoverable before publishing.' });
    if (descriptionValue && descriptionValue.length < 30) checks.push({ level: 'warning', message: 'Description is short; use at least 30 characters for better Bazaar listings.' });
    if (parsedTags.length === 0) checks.push({ level: 'warning', message: 'Add tags to improve Bazaar search visibility.' });
    if (!docsUrl().trim()) checks.push({ level: 'warning', message: 'Add a docs URL to help buyers evaluate the endpoint.' });

    return checks;
  });

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
      setReviewStatus(result.reviewStatus ?? (result.published ? 'published' : 'draft'));
      setIndexingStatus(result.indexingStatus ?? 'not_submitted');
      setIndexingError(result.indexingError ?? '');
      try {
        setServerPreview(await api.getDiscoveryPreview(props.routeId));
      } catch {
        setServerPreview(null);
      }
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
        reviewStatus: reviewStatus(),
      });

      await api.createDiscovery(props.routeId, payload);
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

            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Review status</label>
              <select
                value={reviewStatus()}
                onChange={(e) => setReviewStatus(e.currentTarget.value as 'draft' | 'in_review' | 'published' | 'rejected')}
                class="w-full px-3 py-1.5 border rounded text-sm"
              >
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div class="rounded border bg-gray-50 p-3 text-sm">
            <p class="font-medium text-gray-700">Indexing visibility</p>
            <p class="text-gray-600">Status: <span class="font-mono">{indexingStatus()}</span></p>
            <Show when={indexingError()}>
              <p class="text-red-600">Indexing error: {indexingError()}</p>
            </Show>
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

          <section class="rounded border p-3 space-y-3">
            <div>
              <h4 class="text-sm font-semibold text-gray-800">Quality checks</h4>
              <Show when={qualityChecks().length > 0} fallback={<p class="text-green-700 text-sm">No blocking quality issues detected.</p>}>
                <ul class="space-y-1 mt-2">
                  <For each={qualityChecks()}>{(check) => (
                    <li class={check.level === 'error' ? 'text-red-600 text-sm' : 'text-amber-600 text-sm'}>
                      {check.level === 'error' ? 'Error' : 'Warning'}: {check.message}
                    </li>
                  )}</For>
                </ul>
              </Show>
            </div>
            <div>
              <h4 class="text-sm font-semibold text-gray-800">Listing preview</h4>
              <div class="mt-2 rounded bg-gray-50 p-3 text-sm text-gray-700">
                <p class="font-medium">{category() || serverPreview()?.preview.title || 'Untitled Bazaar listing'}</p>
                <p>{description() || serverPreview()?.preview.summary || 'Add a description to preview the Bazaar summary.'}</p>
                <p class="text-xs text-gray-500 mt-2">MIME: {mimeType() || 'not set'} · Tags: {tags() || 'none'} · Review: {reviewStatus()}</p>
              </div>
            </div>
          </section>

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
