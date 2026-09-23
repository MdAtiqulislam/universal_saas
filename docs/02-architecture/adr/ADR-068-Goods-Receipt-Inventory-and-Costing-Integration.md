# ADR-068: Goods Receipt Inventory and Costing Integration

## Status

Accepted

## Context

When incoming shipments arrive from suppliers against an approved Purchase Order, physical stock must increase, unit costs must be captured into inventory valuation cost layers (M19), serial/batch tracking must be maintained (M09), and accounting clearings must be recorded (M12) without creating disconnected records or allowing over-receipt.

## Decision

1. **Atomic Receiving Execution**:
   - `POST /api/v1/procurement/purchase-orders/:id/receive` runs within an isolated database transaction.
   - Strictly enforces: $\text{Received Quantity} \le \text{Remaining Quantity} = \text{Ordered Quantity} - \text{Received Quantity} - \text{Cancelled Quantity}$. Over-receipt is rejected with `BadRequestException`.
2. **Multi-Layer State Updates**:
   - Creates `GoodsReceipt` (`GR-000001`) with status `POSTED`.
   - Creates M09 `StockMovement` of type `RECEIPT`.
   - Increments M09 `InventoryBalance.quantityOnHand`.
   - Creates M19 `InventoryCostLayer` tracking FIFO/lot layers.
   - Enforces batch number assignment and unique serial number creation for tracked items.
   - Updates PO line `receivedQuantity` and `remainingQuantity`.
   - Automatically transitions PO header to `RECEIVED` (if all lines fulfilled) or `PARTIALLY_RECEIVED`.
3. **Immutability of Posted Receipts**:
   - Once posted, Goods Receipts cannot be edited or deleted.
   - Physical reversals must use `PurchaseReturn` (`PRN-000001`).

## Consequences

- Physical stock and valuation cost layers are always synchronized with purchase order commitments.
- Provides complete three-way matching readiness (`PO` $\to$ `GR` $\to$ `SupplierInvoice`) for M13 Accounts Payable.
