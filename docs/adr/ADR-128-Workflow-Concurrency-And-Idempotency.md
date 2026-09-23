# ADR-128: Workflow Concurrency, Idempotency, and Scheduled Triggers

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M40

## Context

Workflow executions can be triggered in high-volume bursts (e.g. bulk batch events, concurrent webhook webhooks, simultaneous scheduled cron triggers). Duplicate executions or re-running non-idempotent action nodes can lead to double billing, duplicate notifications, or corrupted ERP states.

## Decision

1. **Client & Trigger Idempotency (INV-396)**:
   - External trigger requests accept a `clientIdempotencyKey`. If an execution exists with the same idempotency key in the tenant, the existing execution is returned without creating duplicates.
   - Action nodes compute a deterministic idempotency key combining `executionId`, `nodeKey`, and input parameters, utilizing M36 `IdempotencyService` to guarantee exactly-once action dispatch.
2. **Concurrent Scheduled Execution Prevention (INV-399)**:
   - Workflow schedules maintain run state (`nextRunAt`, `lastRunAt`, `status`). When a schedule triggers, an atomic lease/lock prevents multiple background worker nodes from double-executing the same scheduled interval.
3. **Execution State Transition Concurrency**:
   - Terminal executions cannot be re-executed or modified. Retries generate explicit, tracked compensation attempts or fresh executions with audit lineage.
4. **Resilience & Bounded Backoff**:
   - Asynchronous job execution is managed via M36 `JobService`, leveraging exponential backoff retry policies for transient network or database errors while immediately aborting on deterministic validation failures.

## Consequences

- Workflow execution is completely safe under high concurrency and distributed cluster topologies.
- Re-triggering events or retrying failed executions never produces duplicated downstream side effects.
