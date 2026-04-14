import type { DrizzleInstance } from './types.js';

// Module-level DB resolver — tests can override this
let _resolver: (() => Promise<DrizzleInstance>) | null = null;

export function setDbResolver(resolver: () => Promise<DrizzleInstance>) {
  _resolver = resolver;
}

export function resetDbResolver() {
  _resolver = null;
}

/**
 * Get the current Drizzle instance.
 * In production, imports the shared db module.
 * In tests, uses the injected resolver.
 */
export async function getDb(): Promise<DrizzleInstance> {
  if (_resolver) return _resolver();
  const { db } = await import('./index.js');
  return db;
}
