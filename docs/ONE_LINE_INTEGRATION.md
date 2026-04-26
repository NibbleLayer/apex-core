# One-Line Integration Contract

The target seller developer experience is one line in the API application:

```ts
import { apex } from '@nibblelayer/apex-hono';

app.use(apex());
```

or, when explicit credentials are preferred:

```ts
app.use(apex({ token: process.env.APEX_TOKEN }));
```

## What the one line must do

The `apex()` integration must:

- Resolve the SDK token and control-plane configuration.
- Fetch a signed manifest from Apex.
- Apply x402 middleware based on that manifest.
- Auto-refresh configuration without requiring application redeploys.
- Emit scoped runtime events to Apex.
- Optionally register observed route candidates in draft mode.

## What application code should not need

Seller application code should not need to contain:

- CAIP-2 IDs.
- Facilitator URLs.
- Token contract addresses.
- x402 scheme names such as `exact`.
- Discovery schemas or Bazaar metadata.

Those details belong in the control plane, where they can be validated, reviewed, versioned, and published.

## SDK modes

1. `strict` default/prod: fail closed if the manifest cannot be verified or if x402 verification is unavailable.
2. `dev`: allow a local debug adapter, but make the unsafe behavior visible in logs and responses.
3. `observe`: detect routes and traffic without enforcing payments.

## Dashboard-owned configuration

The dashboard owns:

- Service identity and brand metadata.
- Route monetization policy.
- Pricing rules.
- Network and facilitator presets.
- Wallet destination.
- Bazaar and discovery metadata.
- Publish workflow.

## Security invariants

- Manifests must be signed and versioned.
- Wallet and facilitator changes require audit and approval.
- Auto-registration creates draft routes only.
- SDK event ingestion is scoped and signed.
- Production never passes requests with unverified payment signatures.

## MVP API proposal

- SDK export: `apex(options?: ApexHonoOptions)`
- Token environment variable: `APEX_TOKEN`
- Control-plane URL environment variable: `APEX_URL`
- Internal registration endpoint: `POST /sdk/register`
- Manifest endpoint: `GET /sdk/manifest`
