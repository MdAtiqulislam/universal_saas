# ADR-142: Resilient Provider Failover, Transient Retry, and Webhook Deduplication

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M43

## Context

Third-party communication providers (SMTP relays, SMS aggregators, Apple/Google push notification gateways) experience temporary network degradation, rate limit throttling (HTTP 429), and upstream outages. A single provider failure must not cause permanent delivery failure for critical notifications. In addition, delivery confirmations delivered via provider webhooks must be reconciled idempotently without duplicate side-effects.

## Decision

1. **Automatic Provider Failover (`INV-464`)**:
   - `NotificationDeliveryService` queries configured providers sorted by `priority ASC`.
   - If the primary provider fails with a transient error or exceeds its circuit breaker timeout, the system automatically falls back to secondary and tertiary providers in priority order.
2. **Error Classification & Exponential Backoff (`INV-465`)**:
   - Errors are classified into `TRANSIENT` (e.g., HTTP 429, 503, network timeouts) and `PERMANENT` (e.g., invalid phone number format, blacklisted recipient, unregistered device token).
   - Permanent errors terminate delivery attempts immediately with terminal `FAILED` status, preventing wasted credits.
   - Transient errors schedule exponential backoff retries via `M36 JobService` up to `maxAttempts`.
3. **Provider Webhook Deduplication (`INV-473`)**:
   - Inbound delivery webhooks (e.g., SendGrid events, Twilio status callbacks) are recorded in `NotificationWebhookEvent` with a unique index on `[providerKey, providerEventId]`.
   - Duplicate events are detected, marked `DUPLICATE`, and acknowledged without re-processing.
4. **State Machine Integrity (`INV-467`, `INV-468`)**:
   - Delivery states transition strictly: `PENDING` -> `SENT` -> `DELIVERED` (or `BOUNCED` / `FAILED`).
   - Terminal states (`DELIVERED`, `BOUNCED`) reject conflicting backwards transitions.

## Consequences

- Notification delivery achieves high resilience against provider outages.
- Billing and delivery counters remain accurate under noisy or duplicate webhook retries.
