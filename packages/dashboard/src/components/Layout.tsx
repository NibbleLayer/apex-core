import { createSignal, JSX, onMount, Show } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { api, isAuthenticated, clearApiKey } from '../api/client';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '▦' },
  { path: '/services', label: 'Services', icon: '⚡' },
  { path: '/events', label: 'Events', icon: '◉' },
  { path: '/settlements', label: 'Settlements', icon: '◆' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

export function Layout(props: { children?: JSX.Element }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [orgName, setOrgName] = createSignal('');
  const [sidebarOpen, setSidebarOpen] = createSignal(true);

  onMount(async () => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      const me = await api.me();
      setOrgName(me.name);
    } catch {
      navigate('/login', { replace: true });
    }
  });

  function handleLogout() {
    clearApiKey();
    navigate('/login', { replace: true });
  }

  function isActive(path: string): boolean {
    const current = location.pathname;
    if (path === '/') return current === '/';
    return current.startsWith(path);
  }

  return (
    <div class="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside
        class={`${
          sidebarOpen() ? 'w-56' : 'w-16'
        } bg-gray-900 text-white flex flex-col transition-all duration-200 flex-shrink-0`}
      >
        <div class="p-4 border-b border-gray-700">
          <h1 class="font-bold text-lg truncate">
            {sidebarOpen() ? 'Apex' : 'A'}
          </h1>
          <Show when={sidebarOpen() && orgName()}>
            <p class="text-xs text-gray-400 truncate">{orgName()}</p>
          </Show>
        </div>

        <nav class="flex-1 py-2">
          {NAV_ITEMS.map((item) => (
            <a
              href={item.path}
              class={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                isActive(item.path)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.path);
              }}
            >
              <span class="text-base w-6 text-center">{item.icon}</span>
              <Show when={sidebarOpen()}>
                <span class="ml-3">{item.label}</span>
              </Show>
            </a>
          ))}
        </nav>

        <div class="p-4 border-t border-gray-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen())}
            class="text-gray-400 hover:text-white text-sm w-full text-left"
          >
            {sidebarOpen() ? '← Collapse' : '→'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main class="flex-1 overflow-auto">
        <header class="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-800">
            {NAV_ITEMS.find((i) => isActive(i.path))?.label || 'Apex'}
          </h2>
          <div class="flex items-center gap-4">
            <Show when={orgName()}>
              <span class="text-sm text-gray-500">{orgName()}</span>
            </Show>
            <button
              onClick={handleLogout}
              class="text-sm text-gray-500 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </header>
        <div class="p-6">
          {props.children}
        </div>
      </main>
    </div>
  );
}
