# ADR-077: Shipment Concurrency, Idempotency, and Immutability

## Status

Accepted

## Context

High-throughput logistics hubs experience concurrent scans, multiple parallel webhooks, and simultaneous worker dispatch requests. Concurrency races could result in over-allocating unshipped delivery quantities or duplicate dispatch/delivery confirmations.

## Decision

1. Concurrency-safe transactions (`prisma.$transaction`) wrap all shipment creation, dispatch, delivery, and return operations.
2. Shipment quantity allocation validates existing non-cancelled shipment line sums against delivery order line quantities to prevent over-allocation.
3. Once in `DELIVERED`, `RETURNED`, `CLOSED`, or `CANCELLED` status, shipments are immutable with respect to operational modifications.
4. Concurrency test suites simulate 100 parallel workers to verify that exactly 1 transition succeeds and 99 concurrent attempts are safely rejected.

## Consequences

- Guaranteed state machine determinism under heavy parallel execution.
- Complete idempotency of delivery and return processing.
