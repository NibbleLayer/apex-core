# Apex vs Base x402

| Capability | Base x402 | Apex |
| --- | --- | --- |
| Route configuration | Static route config in code. | Dashboard-managed route registry. |
| Facilitator setup | Manual facilitator setup. | Presets and capability validation. |
| Network and token selection | Manual CAIP-2 IDs and token addresses. | Friendly network and token presets. |
| Discovery | Raw route metadata. | Guided discovery metadata with review workflow (Bazaar-ready infrastructure). |
| Events and settlements | Manual event handling. | Event and settlement ledger. |
| Price changes | Code deploy required for price changes. | Dashboard publish and manifest versioning. |
| Developer expertise | Requires x402 and crypto infrastructure familiarity. | Designed for non-crypto-native API sellers. |

## Nuance

Base x402 is excellent for simple fixed-price endpoints and static demos. It provides the protocol and middleware primitives needed to request, verify, and settle payments.

Apex exists because real sellers need operations, safety, discovery, pricing changes, and business UX. A production seller needs to change prices without redeploying code, select safe facilitator and network presets, manage wallet destinations, publish marketplace metadata, inspect events and settlements, and audit dangerous changes.

## What Apex must not abstract away incorrectly

- Payment finality realities: Apex can explain and surface state, but it must not imply finality before the underlying payment flow provides it.
- Facilitator trust boundaries: Apex must show which facilitator is used and what trust assumptions apply.
- Wallet custody/non-custody: Apex must clearly distinguish seller-controlled wallets from managed custody models.
- Chain/network risk: Apex must expose network risk and capability constraints instead of treating all chains as equivalent.
- Compliance/KYT boundaries: Apex can integrate compliance workflows, but it must not pretend protocol payments remove seller obligations.

## Discovery and Bazaar

Apex currently provides discovery metadata infrastructure: route metadata validation, review states (draft → in-review → published → rejected), indexing status tracking, and a listing preview endpoint. This is **Bazaar-ready infrastructure** — the operational marketplace indexer and Bazaar UI are future capabilities that will consume this metadata.

## Apex Product North Star

- One line of code in the seller API.
- Dashboard governs monetization.
- Manifest is the runtime contract.
- Discovery metadata follows a publish workflow; future Bazaar integration will consume it.
- Every dangerous change is auditable.
