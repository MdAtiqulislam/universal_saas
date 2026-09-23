# ADR-148: Scheduled Search Alerts with M36 Jobs and Omnichannel M43 Delivery

**Status:** Accepted  
**Date:** 2026-09-11  
**Milestone:** M44

## Context

Users need automated notifications when new operational conditions occur (e.g., new high-value sales orders, critical quality defect lots, urgent service tickets). Rather than building redundant scheduling or communication subsystems, search alerting must leverage existing platform capabilities.

## Decision

1. **Reusing M36 Job Scheduling (`INV-495`)**:
   - `SearchAlertsService` registers an asynchronous worker (`search.alert.execute`) with the M36 `JobService` upon module initialization.
   - Creating or updating a search alert schedules periodic evaluation jobs with user-defined intervals (15m, 1h, 6h, 24h).
2. **Idempotent Execution Tracking (`INV-496`)**:
   - Each alert execution generates a deterministic time-bucketed execution ID (`exec_{alertId}_{timeWindow}`).
   - Duplicate evaluations within the active window are skipped, preventing notification storms.
3. **Omnichannel Delivery via M43 (`INV-497`)**:
   - Matches trigger dispatches through `NotificationsService.notify`.
   - All alert notifications respect M43 user communication preferences, recipient channel opt-outs, and tenant quiet hours policies.

## Consequences

- Zero duplicate infrastructure: scheduler and notification pipelines are reused directly.
- Guaranteed adherence to tenant communication governance and recipient quiet hours.
- Highly resilient and observable alert execution with full audit trails.
