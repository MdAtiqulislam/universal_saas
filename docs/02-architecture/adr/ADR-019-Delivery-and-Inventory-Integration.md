# ADR-019: Delivery Orders and Inventory Ledger Integration

## Status

Accepted

## Context

Sales fulfillment requires converting sales order line items into physical goods shipments. When items leave the warehouse, the inventory ledger must record an immutable outbound movement (`StockMovementType.ISSUE`), update location stock balances, decrement reservations, and update the order delivery progress.

## Decision

### 1. Delivery Order Workflow

A delivery order transitions through:
`DRAFT` $\to$ `READY` $\to$ `PICKED` $\to$ `SHIPPED` $\to$ `DELIVERED` (or `CANCELLED`).

### 2. Integration with Milestone M09 Inventory Balances

When a delivery order is executed (`deliver()`):

1. For each delivery order line:
   - Validates that `quantity <= (salesOrderLine.quantity - salesOrderLine.quantityDelivered)`.
   - Invokes `BalancesService.applyStockMovement` with:
     - `movementType: StockMovementType.ISSUE`
     - `referenceType: 'DELIVERY_ORDER'`
     - `referenceId: deliveryNumber`
     - `batchId` / `serialId` (for tracked inventory)
   - Increments `salesOrderLine.quantityDelivered`.
   - Fulfills the associated `InventoryReservation` and decrements `InventoryBalance.quantityReserved` by the delivered quantity.
2. Evaluates aggregate delivery status for the parent `SalesOrder`:
   - If all lines have `quantityDelivered >= quantity` $\implies$ `SalesOrderStatus.DELIVERED`.
   - Otherwise $\implies$ `SalesOrderStatus.PARTIALLY_DELIVERED`.
3. Marks the `DeliveryOrder` as `DELIVERED` and records `deliveredAt`.

### 3. Tracking Integrity

- **Batch Tracking**: Validates batch exists at the warehouse location and reduces the batch quantity.
- **Serial Tracking**: Validates serial exists at the warehouse location with `AVAILABLE` status, transitions serial status to `ISSUED`, and validates delivery line quantity is exactly 1.

## Consequences

- **Positive**: Strict double-entry inventory auditing; end-to-end traceability from quote to warehouse dispatch.
- **Negative**: Delivery actions are irreversible in physical stock; returns require an explicit return receipt (future milestone).
