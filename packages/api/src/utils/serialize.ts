/**
 * Convert a camelCase string to snake_case.
 * Only converts actual camelCase boundaries (lowercase/digit followed by uppercase).
 * Preserves strings like "GET /api/test" that don't contain camelCase patterns.
 */
function camelToSnake(str: string): string {
  return str.replace(/[a-z0-9][A-Z]/g, match =>
    match[0] + '_' + match[1].toLowerCase(),
  );
}

/**
 * Recursively transform all object keys from camelCase to snake_case.
 * Handles nested objects, arrays, and null values.
 * Skips Date objects (returns them as-is for JSON serialization).
 */
export function toSnakeCase<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => toSnakeCase(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = toSnakeCase(value);
  }
  return result as T;
}
