# 15. Provider Webhook Deduplication

## Inbound Delivery Callbacks (`INV-473`)

External communication gateways (Twilio, SendGrid, Mailgun) deliver asynchronous status callbacks:

- **Unique Event Constraint**:
  - Webhook payloads are received by `NotificationWebhooksService` and recorded in `NotificationWebhookEvent`.
  - Enforces compound unique index on `[providerKey, providerEventId]`.
- **Deduplication Logic**:
  - If a webhook payload has already been ingested with the same provider event ID, its status is flagged `DUPLICATE` and duplicate side-effects (e.g. state transitions or metric increments) are skipped.
- **Delivery State Reconciliation**:
  - Valid status events update the associated `NotificationDelivery` status to `DELIVERED`, `BOUNCED`, or `FAILED` with exact timestamps and response codes.
