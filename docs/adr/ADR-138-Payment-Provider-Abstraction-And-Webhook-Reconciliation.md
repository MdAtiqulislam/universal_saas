# ADR-138: Payment Provider Gateway Abstraction and Webhook Reconciliation

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M42

## Context

Enterprise SaaS platforms must accommodate multiple payment providers (Stripe, Paddle, Adyen, regional gateways) without tightly coupling core business logic to vendor-specific SDKs. Additionally, asynchronous webhook notifications from providers require signature verification, replay protection, and reliable state machine reconciliation.

## Decision

1. **Provider-Agnostic Adapter Interface**:
   - The core billing domain interacts exclusively with the `BillingProviderAdapter` interface (`createCustomer`, `createSubscription`, `cancelSubscription`, `processPayment`, `verifyWebhookSignature`).
   - Gateways are decoupled behind adapter implementations (e.g., `SandboxBillingProviderAdapter`).
2. **Zero Raw Secrets & Zero Card Persistence**:
   - Payment credentials, webhook secrets, and provider keys are encrypted at rest using AES-256-GCM (`INV-450`).
   - Primary Account Numbers (PAN) and CVVs are strictly prohibited from platform databases and logs (PCI-DSS SAQ-A compliance). Gateways handle card tokenization externally.
3. **Idempotent Webhook Processing**:
   - Webhook events are deduplicated via a compound unique index on `[providerKey, providerEventId]` in `BillingWebhookEvent` (`INV-449`).
   - Already-processed webhooks are returned without re-dispatching financial side-effects.
4. **Asynchronous Reconciliation**:
   - Inbound webhook notifications update subscription lifecycle statuses and reconcile invoice payment states through unified internal services.

## Consequences

- Gateway providers can be swapped, upgraded, or added with zero disruption to the billing domain.
- The platform maintains strict security and PCI compliance.
