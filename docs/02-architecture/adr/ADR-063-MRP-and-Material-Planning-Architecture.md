# ADR-063: MRP & Material Requirements Planning Architecture

## Status

Accepted

## Context

Enterprise operations require automated material requirement planning to ensure raw materials and subassemblies are procured and produced on schedule to meet sales orders and manufacturing schedules without overstocking inventory.

## Decision

1. Implement a tenant-scoped MRP planning engine in `apps/api/src/planning/`.
2. Model planning runs as transactional headers (`PlanningRun`) transitioning through `DRAFT` $\to$ `RUNNING` $\to$ `COMPLETED` / `FAILED` / `CANCELLED`.
3. Ingest demand from confirmed Sales Orders (M11) and active Production Orders (M25).
4. Ingest supply from available on-hand inventory (M09 net of reservations) and open Purchase Orders (M10) / Production Orders (M25).
5. Generate `PlannedOrder` recommendations without automatically creating live live POs or MOs, ensuring review control.

## Consequences

- Complete end-to-end supply chain visibility.
- Decoupled planning recommendations from execution orders.
- Full multi-tenant isolation and audit logging.
