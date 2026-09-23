# ADR-073: Sales Order Concurrency, Idempotency, and Immutability

## Status

Accepted

## Context

High-concurrency e-commerce and wholesale operations can trigger simultaneous approvals, parallel inventory allocations, and concurrent delivery executions. Without concurrency guards, race conditions can cause double approvals, over-reservations beyond physical stock, duplicate stock issues, or over-deliveries.

## Decision

1. Concurrency Control:
   - All state transitions and inventory updates execute in atomic Prisma transactions (`$transaction`).
   - Strict status verification prevents state regression or parallel duplicate transitions (e.g., 100 parallel approval calls result in exactly 1 success and 99 rejected).
2. Idempotency & Immutability:
   - Orders in `FULFILLED` or `DELIVERED` status are immutable and cannot be cancelled or reverted to draft.
   - Delivery orders in `DELIVERED` status reject subsequent delivery attempts.
   - Delivery lines cannot exceed the remaining deliverable quantity on the corresponding sales order lines.
3. High Precision & Isolation:
   - Quantities and monetary amounts use `Prisma.Decimal` (Decimal 18,4 / 20,4) throughout.
   - Every database operation enforces tenant boundary checks on `organizationId`.

## Consequences

- 100% race-condition resilience under high-concurrency workloads.
- Strict financial and physical inventory integrity.
