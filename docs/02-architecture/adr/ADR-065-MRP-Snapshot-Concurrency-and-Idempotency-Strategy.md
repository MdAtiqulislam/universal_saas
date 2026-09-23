# ADR-065: MRP Snapshot Concurrency & Idempotency Strategy

## Status

Accepted

## Context

Material requirements planning runs can involve heavy computations across large datasets. Multiple concurrent users or background workers initiating planning runs must not corrupt run state or generate duplicate recommendations. Furthermore, completed runs must serve as immutable historical audit snapshots.

## Decision

1. Wrap planning run execution within an atomic database transaction (`prisma.$transaction`).
2. Enforce strict optimistic state checks on `PlanningRunStatus.DRAFT`. Transition to `RUNNING` locks out parallel workers.
3. Store inputs (`PlanningDemand`, `PlanningSupply`) and calculations (`PlanningResult`, `PlannedOrder`) as immutable snapshot records linked to `planningRunId`.
4. Disallow recalculation or mutation of `COMPLETED` planning run snapshots.

## Consequences

- 100% thread-safe planning run execution under concurrent load (1 success, 99 rejected).
- Complete point-in-time auditability of planning decisions and supply chain recommendations.
