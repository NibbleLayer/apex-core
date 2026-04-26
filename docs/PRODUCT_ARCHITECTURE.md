# Apex Product Architecture

Apex is an x402 control plane, not just framework middleware. It gives API sellers a self-hostable operational layer for turning routes into payable products while keeping x402 protocol details behind durable contracts, manifests, and dashboard workflows.

## Product position

Base x402 provides the payment protocol, framework middleware, and facilitator primitives needed to protect an endpoint with payment requirements. Apex builds on those primitives with a route/payment registry, dashboard-managed configuration, manifest generation, seller SDKs, events and settlements, and discovery operations.

The value proposition is explicit: non-crypto-native API sellers can adopt x402 without becoming protocol experts. Seller applications should need one line of integration code, while the Apex dashboard owns operational complexity such as route pricing, facilitator and network selection, wallet destinations, discovery metadata, events, settlements, webhooks, and publish workflows.

```text
Seller API  --one-line SDK-->  Apex SDK  --manifest-->  Apex Control Plane
                                      |                         |
                                      |                         +-- Dashboard config
                                      |                         +-- Facilitator/network presets
                                      |                         +-- Pricing/discovery/wallets
                                      |                         +-- Events/settlements/webhooks
                                      v
                                x402 middleware/facilitator
```

## Layers

### 1. Protocol Layer

The Protocol Layer contains x402 itself: payment requirements, facilitator interactions, verification, and settlement realities. Apex must preserve these semantics instead of hiding risks such as network selection, facilitator trust boundaries, wallet custody, or payment finality.

### 2. Apex Core Layer

The Apex Core Layer is this repository. It contains the public packages, manifests, dashboard, self-hosted API, persistence, and protocol adapters required to operate a portable x402 control plane:

- `@nibblelayer/apex-hono`
- `@nibblelayer/apex-contracts`
- `@nibblelayer/apex-control-plane-core`
- Self-hosted API, dashboard, and persistence
- Manifest builder
- Routes, pricing, wallets, environments, discovery, events, settlements, and webhooks APIs

Core must remain open, portable, and self-hostable so sellers can inspect the runtime contract, keep protocol integration independent from NibbleLayer-managed infrastructure, and adopt x402 without platform lock-in.

### 3. Business/Product Layer

The Business/Product Layer is a future hosted SaaS repository. It should provide onboarding, billing, tenant management, marketplace flows, support, and enterprise features. It must consume core contracts and packages rather than duplicate protocol logic, because duplicated x402 behavior would create divergent manifests, inconsistent payment enforcement, and unsafe operational drift.

## Current state vs target state

| Area | Current state | Target state |
| --- | --- | --- |
| Seller integration | Public Hono SDK exists. | One-line `apex()` integration is the default path. |
| Configuration | Self-hosted APIs and dashboard manage routes, pricing, wallets, environments, discovery, events, settlements, and webhooks. | Dashboard is the primary configuration surface for all monetization operations. |
| Runtime contract | Manifest builder and core contracts exist. | Signed, versioned manifests become the authoritative SDK runtime contract. |
| Protocol details | x402 configuration still requires technical understanding in some paths. | Non-crypto-native sellers use friendly presets and advanced-mode escape hatches. |
| Discovery | Discovery APIs exist. | Discovery and Bazaar publishing become guided publish workflows. |
| Operations | Events, settlements, and webhooks APIs exist. | Events and settlements form an auditable operational ledger. |
| Commercial layer | `apex-managed` is out of scope. | Future business repo consumes published core packages and signed manifests. |
