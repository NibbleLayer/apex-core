# @nibblelayer/apex-hono

Hono middleware SDK that connects your application to the Apex control plane for x402 payment-gated routes.

## Install

```bash
pnpm add @nibblelayer/apex-hono hono
```

## Quick Start

Set the SDK token and Apex API URL in your runtime environment:

```bash
export APEX_TOKEN="apx_sdk_your_scoped_token"
export APEX_URL="http://localhost:3000"
```

```ts
import { Hono } from 'hono';
import { apex } from '@nibblelayer/apex-hono';

const app = new Hono();

// Protect routes with x402 payment middleware. The scoped SDK token resolves
// service and environment from Apex; app code does not need those IDs.
app.use('/api/premium/*', apex());

// Unprotected routes work normally
app.get('/api/free', (c) => c.json({ message: 'free content' }));

// Protected route - requires payment
app.get('/api/premium/weather', (c) => c.json({ temp: 22 }));

export default app;
```

You can also pass values explicitly, which override environment variables:

```ts
app.use('/api/premium/*', apex({
  token: 'apx_sdk_your_scoped_token',
  apexUrl: 'https://api.apex.example.com',
}));
```

## API Reference

### `apex(options?)`

One-line Hono middleware factory. It resolves `token` from `options.token`,
`options.apiKey`, or `APEX_TOKEN`, and resolves `apexUrl` from `options.apexUrl`
or `APEX_URL`. Scoped SDK tokens (`apx_sdk_...`) use the signed `/sdk/manifest`
endpoint so Apex can infer service and environment from the token.

```ts
interface ApexHonoOptions {
  token?: string;                         // Preferred scoped SDK token alias
  apiKey?: string;                        // Backward-compatible alias
  apexUrl?: string;                       // Apex API base URL
  serviceId?: string;                     // Optional strict binding or legacy mode
  environment?: 'test' | 'prod';          // Optional strict binding or legacy mode
  refreshIntervalMs?: number;
  enableIdempotency?: boolean;
  eventDelivery?: 'fire-and-forget' | 'batched';
  useSignedManifest?: boolean;
  verifySignedManifest?: boolean;
}
```

### Lower-level API

### `createApexClient(config)`

Factory function. Creates and initializes an `ApexClient` instance.

```ts
import { createApexClient } from '@nibblelayer/apex-hono';

const client = createApexClient({
  apiKey: 'apex_your_key',
  serviceId: 'svc_your_service',
  environment: 'test',
  apexUrl: 'http://localhost:3000',
});

app.use('/api/premium/*', await client.protect());

client.on('payment.settled', (data) => {
  console.log('Payment settled:', data);
});
```

### `ApexClientConfig`

```ts
interface ApexClientConfig {
  apiKey: string;               // Apex API key (apex_...) or scoped SDK token (apx_sdk_...)
  serviceId?: string;           // Required for legacy unsigned mode
  environment?: 'test' | 'prod';// Required for legacy unsigned mode
  apexUrl: string;              // Apex API base URL
  refreshIntervalMs?: number;   // Manifest refresh interval (default: 60000)
  enableIdempotency?: boolean;  // Add payment-identifier extension (default: true)
  eventDelivery?: 'fire-and-forget' | 'batched'; // Event delivery mode (default: 'fire-and-forget')
  useSignedManifest?: boolean;  // Defaults true for apx_sdk_ tokens
  verifySignedManifest?: boolean; // Defaults true in signed mode
}
```

### `ApexClient` Methods

| Method | Signature | Description |
|---|---|---|
| `protect()` | `() => Promise<MiddlewareHandler>` | Returns Hono middleware that enforces x402 payment on matching routes |
| `refreshManifest()` | `() => Promise<void>` | Force an immediate manifest refresh from the Apex API |
| `on()` | `(event: SDKEventType, handler: Function) => void` | Register an event listener |
| `off()` | `(event: SDKEventType, handler: Function) => void` | Remove an event listener |
| `close()` | `() => void` | Stop the refresh timer and clean up resources |

### Events

| Event | Description |
|---|---|
| `manifest.refreshed` | Manifest successfully re-fetched and validated |
| `manifest.stale` | Manifest refresh failed; using cached version |
| `payment.verified` | A payment was verified for a protected route |
| `payment.settled` | A payment was settled on-chain |
| `payment.failed` | A payment failed verification or settlement |

## Error Handling

```ts
import {
  ApexConnectionError,
  ApexManifestValidationError,
} from '@nibblelayer/apex-hono';

try {
  const apex = createApexClient(config);
  await apex.protect();
} catch (err) {
  if (err instanceof ApexConnectionError) {
    // Network or API connectivity failure
    console.error('Connection failed:', err.message);
    console.error('Cause:', err.cause);
  }

  if (err instanceof ApexManifestValidationError) {
    // Manifest failed Zod validation
    console.error('Validation issues:', err.issues);
  }
}
```

| Error Class | Properties | Description |
|---|---|---|
| `ApexConnectionError` | `.message`, `.cause` | Thrown when the SDK cannot reach the Apex API |
| `ApexManifestValidationError` | `.message`, `.issues` | Thrown when the fetched manifest fails schema validation |

## How It Works

1. **Initialization** — `apex()` constructs the client immediately but fetches the manifest lazily on the first request.
2. **Validation** — Signed SDK manifests are verified and then validated against `apexManifestSchema` (Zod). Invalid manifests throw `ApexManifestValidationError`.
3. **Middleware assembly** — Route-level x402 payment middleware is built from manifest route definitions. If `enableIdempotency` is `true`, a `payment-identifier` extension is added to each route.
4. **Auto-refresh** — The manifest is re-fetched at `refreshIntervalMs` intervals. If a refresh fails, a `manifest.stale` event is emitted and the cached manifest continues to serve requests.
5. **Fallback** — If `@x402/hono` is not installed, the SDK falls back to an adapter middleware that returns `402 Payment Required` with the manifest pricing details.

## Peer Dependencies

- `hono` >= 4.0.0
- `@x402/hono` (optional — enables full x402 payment protocol support; falls back to basic 402 responses when absent)

## License

[Apache-2.0](../../LICENSE)
