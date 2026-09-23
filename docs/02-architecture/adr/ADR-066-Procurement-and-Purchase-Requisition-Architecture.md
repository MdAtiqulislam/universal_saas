# ADR-066: Procurement and Purchase Requisition Architecture

## Status

Accepted

## Context

Milestone M26 established Material Requirements Planning (MRP) to generate planned procurement recommendations (`PlannedOrder` with `action = PURCHASE`). Milestone M27 requires a production-grade procurement execution architecture that converts planning recommendations into actionable requisitions and purchase orders without creating direct coupling or bypassing organizational approval workflows.

## Decision

1. **Requisition as Intermediate Procurement Control**:
   - M26 `PlannedOrder` records are converted into `PurchaseRequisition` (`PR-000001`) instead of creating direct Purchase Orders.
   - `PurchaseRequisition` implements a distinct lifecycle: `DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `CONVERTED` $\to$ `CANCELLED` / `REJECTED`.
2. **Traceable Procurement Chain**:
   - Each Purchase Requisition stores `sourcePlannedOrderId` and `sourcePlanningRunId`.
   - On conversion, `PlannedOrder.status` is updated to `CONVERTED`, preventing double-conversion while maintaining the immutability of historical MRP snapshots.
3. **Conversion to Purchase Order**:
   - Approved requisitions can be converted into `PurchaseOrder` (`PO-000001`), linking back to the source requisition and maintaining full traceability.

## Consequences

- Maintains a clean boundary between supply planning (M26) and procurement execution (M27).
- Departmental users and procurement managers can review, bundle, or adjust item requisitions prior to vendor order placement.
- Provides complete end-to-end traceability from finished goods demand to supplier delivery.
