# Webhooks

## Outbound Webhooks

Outbound webhooks notify external subscribers when events occur within the platform (e.g., `sales.order.created`, `shipment.dispatched`, `invoice.paid`).

### Delivery Guarantees

- **Asynchronous Execution**: Deliveries are queued via background jobs, isolating internal transactions from external network latency.
- **Exponential Backoff Retry**: Failed deliveries retry up to 5 times with exponential backoff (1m, 2m, 4m, 8m).
- **Dead-Letter Queue**: Deliveries that fail all attempts are moved to `DEAD_LETTER` status for inspection.

### Signature Verification

Outbound payloads include the following verification headers:

- `X-Webhook-Signature`: HMAC-SHA256(`${timestamp}.${body}`, signingSecret)
- `X-Webhook-Timestamp`: Unix timestamp (seconds)
- `X-Webhook-Event`: Event name
- `X-Webhook-Delivery-Id`: Delivery identifier

## Inbound Webhooks

External systems push status updates to the platform via:

```
POST /api/v1/webhooks/inbound/:provider/:connectionKey
```

- **Idempotency**: Requests are deduplicated using `(connectionId, providerEventId)` backed by `IdempotencyService`.
- **Signature Verification**: Verified against the connection's stored `WEBHOOK_SECRET` credential.
