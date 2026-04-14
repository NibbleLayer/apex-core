import { createSignal, onCleanup } from 'solid-js';

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = createSignal<T | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  async function poll() {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  poll();
  const timer = setInterval(poll, intervalMs);
  onCleanup(() => clearInterval(timer));

  return { data, loading, error, refetch: poll };
}
