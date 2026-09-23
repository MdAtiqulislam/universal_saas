# 10. Inbound Webhook Reconciliation & Idempotency

## Webhook Ingestion Pipeline (INV-449)

External payment gateways notify the platform of asynchronous events (subscription changes, payments, chargebacks):

1. **Signature Verification**: Validates the webhook payload against configured cryptographic secrets (`verifyWebhookSignature`).
2. **Idempotent Deduplication**: Checks `[providerKey, providerEventId]` in `BillingWebhookEvent`. If previously processed, skips re-execution.
3. **State Machine Dispatch**: Maps provider events to platform actions:
   - `subscription.activated` $\rightarrow$ Transition to `ACTIVE`
   - `subscription.past_due` $\rightarrow$ Transition to `PAST_DUE`
   - `subscription.cancelled` $\rightarrow$ Transition to `CANCELLED`
   - `invoice.payment_succeeded` $\rightarrow$ Settles invoice balance
4. **Audit & Event Trail**: Marks event status as `PROCESSED` and emits `billing.webhook.processed`.
