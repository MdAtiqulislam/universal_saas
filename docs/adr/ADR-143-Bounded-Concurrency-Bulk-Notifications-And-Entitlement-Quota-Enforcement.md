# ADR-143: Bounded Concurrency Bulk Notifications and Entitlement Quota Enforcement

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M43

## Context

High-volume campaigns, product announcements, and system alerts require sending notifications to thousands of recipients concurrently. Unconstrained dispatch storms degrade database connection pools, exhaust memory, and trigger rate-limiting bans from external provider gateways. Furthermore, outbound communications must respect subscription tiers, metered usage limits, and tenant quotas implemented in M42.

## Decision

1. **Bounded Concurrency Dispatch (`INV-472`)**:
   - `BulkNotificationsService` partitions large recipient batches into chunks processed with bounded concurrency (`concurrency = 10` by default).
   - Utilizes `Promise.all` over fixed worker pools rather than unbounded fan-out, protecting Node.js event loop latency and database pool health.
2. **Deterministic Idempotency (`INV-469`)**:
   - Dispatches accept an optional client `idempotencyKey`.
   - Repeated dispatches within the 24-hour window return the existing notification and delivery records without duplicate messages or double-metered billing.
3. **M42 Entitlement Quota Enforcement (`INV-474`, `INV-475`)**:
   - Before executing dispatches, `NotificationsService` verifies channel entitlements against `BillingService` (e.g., whether SMS is permitted on the tenant's plan).
   - Dispatches record metered usage units (e.g., `notifications.email.sent`, `notifications.sms.sent`) to update tenant usage meters atomically.
4. **Scheduled Future Delivery (`INV-471`)**:
   - Future scheduled dispatches are stored in `NotificationSchedule` in `PENDING` state and registered with `M36 JobService`.
   - On execution, status updates atomically to `EXECUTED` before invoking `NotificationsService.notify`.

## Consequences

- Prevents resource exhaustion and noisy-neighbor degradation across multi-tenant workloads.
- Monolithic scalability is preserved without requiring external message brokers or complex queue clusters.
- All communications are metered and monetized according to plan entitlements.
