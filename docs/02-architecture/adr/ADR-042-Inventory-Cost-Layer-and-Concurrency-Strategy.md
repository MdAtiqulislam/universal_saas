# ADR-042: Inventory Cost Layer and Concurrency Strategy

## Status

Accepted

## Context

Future requirements mandate support for FIFO (First-In, First-Out) and specific batch costing alongside Weighted Average Costing. Additionally, high-volume operational warehouses incur concurrent receipts and delivery issues against identical SKUs.

## Decision

1. **Granular Cost Layers**:
   - Every inbound receipt creates an `InventoryCostLayer` tracking `receiptQuantity`, `unitCost`, `remainingQuantity`, and `consumedQuantity`.
   - Outbound issues consume oldest layers chronologically (`createdAt ASC`), laying the foundation for FIFO valuation.
2. **Transactional Concurrency**:
   - Valuation updates and cost layer mutations execute inside isolated database transactions (`prisma.$transaction`).
   - Prevents lost updates, double consumption, and negative inventory layer values.

## Consequences

- **Positive**: High data fidelity, seamless FIFO extensibility, robust concurrency handling.
- **Negative**: Database writes for cost layer records on high-volume inbound batches.
