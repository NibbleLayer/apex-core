import type {
  ApexManifest,
  ManifestRouteExtensions,
} from '@nibblelayer/apex-contracts';

/**
 * Add payment-identifier extension to manifest routes if idempotency is enabled.
 * This configures the x402 middleware to support safe retries.
 *
 * The extension is declared per-route in the manifest.
 * When idempotencyEnabled is true, all routes get:
 *   extensions['payment-identifier'] = { required: false }
 *
 * 'required: false' means buyers can omit the identifier, but if they
 * include it, the server will cache responses and deduplicate.
 */
export function applyIdempotency(
  manifest: ApexManifest,
): ApexManifest {
  if (!manifest.idempotencyEnabled) {
    return manifest;
  }

  const routes = { ...manifest.routes };
  for (const key of Object.keys(routes)) {
    const route = { ...routes[key] };
    const extensions: ManifestRouteExtensions = {
      ...route.extensions,
      'payment-identifier': { required: false },
    };
    route.extensions = extensions;
    routes[key] = route;
  }

  return { ...manifest, routes };
}
