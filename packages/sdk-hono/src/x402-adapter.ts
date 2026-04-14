import type { ApexManifest } from '@nibblelayer/apex-contracts';
import type { Context, Next } from 'hono';

/**
 * Minimal adapter that implements the x402 protocol behavior when @x402/hono
 * is not installed. This will be replaced with the real middleware in production.
 *
 * Protocol behavior:
 * - If no PAYMENT-SIGNATURE header: return 402 with PAYMENT-REQUIRED
 * - If PAYMENT-SIGNATURE present: pass through (real @x402/hono handles verify/settle)
 */
export function createPaymentMiddleware(manifest: ApexManifest) {
  return async (c: Context, next: Next) => {
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const routeKey = `${method} ${path}`;

    // Find matching route — try exact match first, then pattern match
    const routeConfig = findRoute(manifest.routes, routeKey, method, path);
    if (!routeConfig) {
      // Not a protected route — pass through
      return next();
    }

    const paymentSignature = c.req.header('PAYMENT-SIGNATURE');

    if (!paymentSignature) {
      // Return 402 with payment requirements
      const requirements = {
        accepts: routeConfig.accepts.map((a) => ({
          scheme: a.scheme,
          maxAmountRequired: a.price,
          network: a.network,
          payTo: a.payTo,
          asset: manifest.wallet.token,
        })),
        description: routeConfig.description,
        mimeType: routeConfig.mimeType,
        extensions: routeConfig.extensions,
      };

      return new Response(
        JSON.stringify({ error: 'Payment Required', requirements }),
        {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': Buffer.from(
              JSON.stringify(requirements),
            ).toString('base64'),
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Payment signature present — pass through to route handler.
    // In production, the real @x402/hono middleware would verify with the facilitator.
    return next();
  };
}

/**
 * Find a matching route config. Supports exact "METHOD /path" keys
 * and wildcard patterns like "GET /api/*".
 */
function findRoute(
  routes: ApexManifest['routes'],
  routeKey: string,
  method: string,
  path: string,
): ApexManifest['routes'][string] | undefined {
  // Exact match
  if (routes[routeKey]) {
    return routes[routeKey];
  }

  // Pattern match (e.g., "GET /api/*" matches "GET /api/weather")
  for (const [pattern, config] of Object.entries(routes)) {
    const parts = pattern.split(' ');
    if (parts.length !== 2) continue;

    const [patternMethod, patternPath] = parts;
    if (patternMethod !== method) continue;

    // Convert pattern to regex: /api/* → /api/.*  and  /api/:id → /api/[^/]+
    const regexPath = patternPath
      .replace(/\*/g, '.*')
      .replace(/:([^/]+)/g, '[^/]+');
    const regex = new RegExp(`^${regexPath}$`);

    if (regex.test(path)) {
      return config;
    }
  }

  return undefined;
}
