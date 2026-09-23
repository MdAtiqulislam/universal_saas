# ADR-087: Return Eligibility Validation and Reverse Logistics Tracking

## Context

Customer and supplier returns must strictly prevent over-returning beyond delivered or received quantities. Furthermore, reverse logistics requires tracing reverse transit back to original shipments, delivery orders, or goods receipts while enforcing return policy windows and tenant boundaries.

## Decision

1. Customer Return Eligibility:
   - Evaluates `deliveredQuantity` from linked `DeliveryOrderLine` or `SalesOrderLine`.
   - Aggregates historical `ReturnRequestLine` quantities across non-rejected/non-cancelled RMAs.
   - Enforces invariant: `requestedQuantity <= deliveredQuantity - previouslyReturnedQuantity`.
2. Supplier Return Eligibility:
   - Evaluates `receivedQuantity` from linked `GoodsReceiptLine` or `PurchaseOrderLine`.
   - Enforces invariant: `requestedQuantity <= receivedQuantity - previouslyReturnedQuantity`.
3. Policy Enforcement:
   - Dynamic `ReturnPolicy` checks `returnWindowDays` against source document timestamps.
   - Restricts replacement quantities to configured `maxReplacementQty`.
4. Reverse Logistics Linkage:
   - Supports linking both `shipmentId` (original outbound shipment) and `reverseShipmentId` (inbound reverse transit carrier tracking).

## Consequences

- Completely eliminates fraudulent, duplicated, or excessive return authorizations.
- Provides end-to-end trace from original delivery to reverse transit and warehouse receipt.
