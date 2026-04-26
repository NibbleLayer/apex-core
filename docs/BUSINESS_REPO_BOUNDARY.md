# Business Repository Boundary

## `apex-core`

This repository is the Apex OSS core. It provides:

- Self-hosted control plane.
- Public contracts and SDKs.
- Protocol adapters and manifest generation.
- Open, portable, inspectable runtime behavior for x402-powered seller APIs.

## Future business repository

A future business repository should contain the hosted Apex managed SaaS product surface, including:

- Onboarding funnels.
- Billing and subscriptions.
- Hosted facilitator presets and secrets.
- Tenant management.
- Support, enterprise, and compliance features.
- Marketplace and business UI.

## Dependency rule

The business repository may depend on published core packages, but it must not fork protocol logic. Protocol behavior, manifest construction, public schemas, and SDK-facing contracts belong in `apex-core`.

## Shared contract strategy

- `@nibblelayer/apex-contracts` is the source-code boundary.
- Signed manifests are the runtime boundary.
- Events and webhooks are the integration boundary.

## Migration path

1. Stabilize core OSS v0.1.
2. Add signed manifest and token model.
3. Expose hosted-compatible APIs.
4. Create the business repository consuming core packages.

## Commercial features that should remain out of OSS core

- Tenant billing.
- Enterprise SSO/RBAC beyond local admin basics.
- Managed secrets/KMS.
- Marketplace monetization and revenue share.
- Support workflows.
