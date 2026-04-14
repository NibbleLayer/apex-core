import { createMiddleware } from 'hono/factory';
import { toSnakeCase } from '../utils/serialize.js';

/**
 * Middleware that automatically converts all JSON response bodies
 * from camelCase (Drizzle output) to snake_case (API contract).
 *
 * Applied AFTER the route handler runs, so it transforms the response
 * body before sending it to the client.
 */
export const serializeMiddleware = createMiddleware(async (c, next) => {
  await next();

  if (c.res.headers.get('x-apex-skip-serialization') === '1') {
    c.res.headers.delete('x-apex-skip-serialization');
    return;
  }

  // Only transform JSON responses
  const contentType = c.res.headers.get('Content-Type');
  if (contentType?.includes('application/json')) {
    try {
      const body = await c.res.json();
      const transformed = toSnakeCase(body);
      c.res = c.json(transformed, c.res.status);
    } catch {
      // Not JSON or already consumed — skip
    }
  }
});
