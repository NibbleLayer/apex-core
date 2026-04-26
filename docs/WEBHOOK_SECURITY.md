# Webhook Security

Apex signs every webhook delivery with these headers:

- `X-Apex-Signature`: HMAC signature in `sha256=<hex>` format.
- `X-Apex-Timestamp`: Unix timestamp used in the signature payload.
- `X-Apex-Delivery-Id`: Unique delivery identifier for retry-safe deduplication.
- `X-Apex-Event-Type`: Event type being delivered.

## Signature verification

Build the signed payload from the exact raw request body:

```text
${timestamp}.${deliveryId}.${rawBody}
```

Compute an HMAC SHA-256 digest using the endpoint secret, then compare it to the
hex value from `X-Apex-Signature` using a constant-time comparison. Reject any
request with a missing or invalid signature.

Receivers must also reject stale timestamps to limit replay risk. A maximum age
of 5 minutes is recommended.

## Retry safety

Webhook handlers should be idempotent. Dedupe processed deliveries by
`X-Apex-Delivery-Id` and, when available in the payload, by event id. This keeps
receivers safe when Apex retries a delivery.

Retry, backoff, and dead-letter behavior for failed deliveries is visible in the
Apex dashboard and API.
