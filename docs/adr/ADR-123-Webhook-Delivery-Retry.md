# ADR-123: Webhook Delivery Retry Strategy

**Status:** Accepted  
**Date:** 2026-09-02  
**Milestone:** M39

## Context

Outbound webhook delivery relies on external network reliability and subscriber server availability. Webhook deliveries must survive transient network partitions, subscriber rate limits, and temporary downtime without blocking platform transaction processing.

## Decision

1. **Background job execution**: All webhook deliveries run asynchronously via the M36 `JobService` (`WEBHOOK_DELIVERY` and `WEBHOOK_RETRY` handlers), completely decoupling delivery from transactional domain event generation.
2. **Exponential backoff with jitter**: Retries are scheduled with exponential delays calculated as `2^attemptCount * 60,000 ms` (1m, 2m, 4m, 8m).
3. **Dead-letter queuing**: Deliveries exceeding `maxAttempts` (default 5) are transitioned to `DEAD_LETTER` status, preventing infinite delivery loops.
4. **Per-subscription health tracking**: Consecutive delivery failures increment `failureCount` on the subscription, allowing automatic alerting and potential suspension of failing endpoints.
5. **Deduplication and idempotency**: Each delivery is uniquely identified by `(subscriptionId, integrationEventId)`, preventing duplicate delivery records.
6. **Payload signatures**: Outbound requests include `X-Webhook-Signature` (HMAC-SHA256) and `X-Webhook-Timestamp` for destination verification.

## Consequences

- External failures cannot degrade internal API response times or database throughput.
- Guaranteed at-least-once delivery semantics for all subscribers.
- Dead-lettered deliveries remain queryable for audit, troubleshooting, and manual re-triggering.
