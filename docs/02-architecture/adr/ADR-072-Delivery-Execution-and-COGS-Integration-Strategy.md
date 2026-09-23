# ADR-072: Delivery Execution and COGS Integration Strategy

## Status

Accepted

## Context

When goods are physically shipped to a customer via a Delivery Order, the platform must issue stock from the warehouse, fulfill active reservations, record Cost of Goods Sold (COGS), update sales order fulfillment quantities, and allow downstream customer invoicing.

## Decision

1. Delivery Order state transitions: `DRAFT -> READY -> PICKED -> DISPATCHED -> DELIVERED -> CLOSED`.
2. Atomic Delivery Execution (`executeDelivery`):
   - Check status is not already `DELIVERED` or `CANCELLED`.
   - Issue stock using M09 `BalancesService.applyStockMovement(..., movementType: ISSUE)`.
   - Fulfill/release matching `InventoryReservation` and decrement `InventoryBalance.quantityReserved`.
   - Delegate COGS entry generation to M19 `CogsService.recordAndPostCogs()` creating balanced General Ledger journals (`Debit COGS / Credit INVENTORY_ASSET`).
   - Increment `SalesOrderLine.quantityDelivered`.
   - Update parent `SalesOrder.status` to `FULFILLED` (if all lines delivered) or `PARTIALLY_FULFILLED`.
3. Invoicing delegation:
   - Provide `POST /api/v1/sales/orders/:id/invoice` delegating directly to M14 `CustomerInvoicesService.createFromSalesOrder`.

## Consequences

- Guaranteed atomicity between physical inventory movements, accounting COGS entries, and commercial order status.
- Zero duplication of invoicing or COGS engines.
