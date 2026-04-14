import { For, createSignal, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api } from '../api/client';
import { slugifyServiceName } from '../api/payloads';
import type { Service } from '../api/types';

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = createSignal<Service[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [showCreate, setShowCreate] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [newSlug, setNewSlug] = createSignal('');
  const [newDesc, setNewDesc] = createSignal('');
  const [slugEdited, setSlugEdited] = createSignal(false);

  async function loadServices() {
    try {
      setLoading(true);
      const data = await api.listServices();
      setServices(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }

  onMount(loadServices);

  async function handleCreate(e: Event) {
    e.preventDefault();
    try {
      const generatedSlug = slugifyServiceName(newName());
      await api.createService({
        name: newName().trim(),
        slug: newSlug().trim() || generatedSlug,
        description: newDesc() || undefined,
      });
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      setNewDesc('');
      setSlugEdited(false);
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service');
    }
  }

  function handleNameInput(value: string) {
    setNewName(value);
    if (!slugEdited()) {
      setNewSlug(slugifyServiceName(value));
    }
  }

  function handleSlugInput(value: string) {
    setSlugEdited(true);
    setNewSlug(slugifyServiceName(value));
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Services</h1>
        <button
          onClick={() => setShowCreate(!showCreate())}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showCreate() ? 'Cancel' : '+ New Service'}
        </button>
      </div>

      <Show when={showCreate()}>
        <form onSubmit={handleCreate} class="bg-white p-6 rounded-lg shadow mb-6">
          <h3 class="text-lg font-semibold mb-4">Create Service</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={newName()}
                onInput={(e) => handleNameInput(e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="My API Service"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={newSlug()}
                  onInput={(e) => handleSlugInput(e.currentTarget.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="my-api-service"
                />
                <p class="mt-1 text-xs text-gray-500">Generated from the name by default; you can override it.</p>
              </div>
          </div>
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={newDesc()}
              onInput={(e) => setNewDesc(e.currentTarget.value)}
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description"
            />
          </div>
          <button
            type="submit"
            disabled={!newName().trim()}
            class="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            Create
          </button>
        </form>
      </Show>

      <Show when={error()}>
        <div class="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error()}</div>
      </Show>

      <Show when={loading()}>
        <p class="text-gray-500">Loading services...</p>
      </Show>

      <Show when={!loading() && services().length === 0}>
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-500">No services yet. Create your first service to get started.</p>
        </div>
      </Show>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <For each={services()}>
          {(service) => (
            <div
              class="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 border-blue-500"
              onClick={() => navigate(`/services/${service.id}`)}
            >
              <h3 class="text-lg font-semibold text-gray-900">{service.name}</h3>
              <p class="text-sm text-gray-500 mt-1">{service.slug}</p>
              <Show when={service.description}>
                <p class="text-sm text-gray-600 mt-2">{service.description}</p>
              </Show>
              <div class="mt-4 flex items-center gap-2">
                <Show when={service.environments}>
                  <span class="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">
                    {service.environments!.length} env{service.environments!.length !== 1 ? 's' : ''}
                  </span>
                </Show>
                <Show when={service.routeCount ?? service.routes?.length}>
                  <span class="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    {service.routeCount ?? service.routes?.length ?? 0} route{(service.routeCount ?? service.routes?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                </Show>
              </div>
              <p class="text-xs text-gray-400 mt-3">
                Created {new Date(service.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
