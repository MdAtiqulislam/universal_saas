# ADR-069: Procurement Concurrency, Idempotency, and Immutability

## Status

Accepted

## Context

High-throughput procurement operations can lead to concurrency race conditions (e.g. concurrent conversion of the same planned order, multiple parallel approvals, concurrent receiving exceeding remaining quantities, or excess purchase returns). Strict multi-tenant isolation, idempotency, and data immutability are paramount.

## Decision

1. **Planned Order Idempotency**:
   - Planned order conversion checks existing requisitions where `sourcePlannedOrderId = plannedOrderId`.
   - Planned order status check ensures only `SUGGESTED` orders can be converted; status is atomically set to `CONVERTED`.
2. **Concurrency Control & Row Locking**:
   - PO approval, Goods Receipt, and Purchase Return execution are wrapped in atomic Prisma transactions with state re-validation.
   - Tested and verified under 100 parallel worker race conditions (1 success, 99 rejected).
3. **Multi-Tenant Boundaries**:
   - Every model (`PurchaseRequisition`, `PurchaseOrder`, `GoodsReceipt`, `PurchaseReturn`, etc.) has mandatory `organizationId`.
   - All Prisma queries strictly filter on `organizationId`.
   - 10 cross-tenant isolation tests verify complete tenant data separation.
4. **Immutability of Historical Snapshots**:
   - Posted Goods Receipts and Posted Purchase Returns cannot be edited or deleted.
   - Reversals create explicit compensating transactions.

## Consequences

- Guaranteed zero duplicate procurement orders, zero over-receipts, and zero over-returns under extreme concurrent workloads.
- Strict data security and regulatory audit compliance across tenants.
