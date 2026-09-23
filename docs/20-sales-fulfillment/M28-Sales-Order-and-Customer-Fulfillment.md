# Milestone M28 — Sales Order Management & Customer Fulfillment Foundation

## 1. Executive Summary

Milestone M28 delivers the authoritative **Sales Order Management and Customer Fulfillment Foundation** for the Universal Business Operations SaaS platform. It connects customer commercial demand with physical warehouse inventory allocation, delivery dispatch, M19 Cost of Goods Sold (COGS) general ledger recognition, and M14 Accounts Receivable sales invoicing.

```text
Customer (M11)
      │
      ▼
Sales Order (M28) ───[Submit & Approve]───► Credit Limit & Active Validation
      │
      ▼
Inventory Availability & Allocation (M09)
      │
      ▼
Delivery Order Execution (M28)
      ├─► Stock Issue (M09 BalancesService)
      ├─► COGS Recognition (M19 CogsService)
      └─► Fulfill Reservations
      │
      ▼
Customer Invoicing (M14) ──► Customer Payment & Settlement (M15)
```

---

## 2. Domain Model & Lifecycle State Machines

### 2.1 Sales Order Lifecycle

- `DRAFT`: Order creation and line definition. Fully mutable.
- `SUBMITTED`: Submitted for managerial / commercial approval.
- `APPROVED`: Commercial validation passed (customer active, credit limits checked).
- `ALLOCATED`: Inventory reserved in warehouse via M09 `InventoryReservation`.
- `PARTIALLY_RESERVED`: Partial quantity reserved due to stock constraints.
- `PARTIALLY_FULFILLED`: Partial shipment delivered via delivery order.
- `FULFILLED`: All lines fully delivered (`quantityDelivered >= quantity`).
- `CLOSED`: Final administrative closure.
- `CANCELLED`: Order cancelled, releasing any active inventory reservations.
- `REJECTED`: Order rejected during approval workflow with reason.
- `VOIDED`: Administrative voiding.

### 2.2 Delivery Order Lifecycle

- `DRAFT`: Shipment creation against approved/allocated sales order lines.
- `READY`: Picking ticket generated and staged.
- `PICKED`: Goods picked from warehouse bins.
- `DISPATCHED`: Shipped/dispatched with logistics carrier.
- `DELIVERED`: Outbound stock issued, COGS recorded, sales order delivered quantities incremented.
- `CLOSED`: Completed delivery lifecycle.
- `CANCELLED`: Cancelled delivery prior to physical shipment.

---

## 3. Core Architectural Integrations

1. **M09 Inventory & Reservations**:
   - `checkAvailability()` is strictly read-only and calculates available on-hand stock minus existing reservations.
   - `allocate()` creates `InventoryReservation` records and increments `quantityReserved` on `InventoryBalance`.
   - `releaseAllocation()` releases active reservations and restores available stock.
2. **M19 COGS & General Ledger**:
   - `executeDelivery()` delegates to `CogsService.recordAndPostCogs()` during atomic delivery transaction to create `Debit COGS / Credit INVENTORY_ASSET` double-entry journals.
3. **M14 Accounts Receivable & Invoicing**:
   - Direct integration via `CustomerInvoicesService.createFromSalesOrder()` ensuring single authoritative invoice engine.
4. **Tenant Isolation & Security**:
   - Strict `organizationId` multi-tenant boundaries on all queries, transactions, and event streams.
   - 14 granular RBAC permissions (`sales.orders.*`, `sales.deliveries.*`, `sales.fulfillment.view`, `sales.reports.view`).

---

## 4. Fulfillment Reporting Suite

1. **Sales Order Summary**: Global order counts, ordered quantities, delivered quantities, remaining quantities, ordered amounts, invoiced amounts, and overall fulfillment rate.
2. **Open Sales Orders**: Detailed listing of pending and partially fulfilled orders.
3. **Fulfillment Report**: Per-line fulfillment progress, unit pricing, allocated quantity, delivered quantity, and fulfillment percentage.
4. **Customer Order History**: Chronological view of customer orders, delivery orders, and customer invoices.
5. **Delivery Performance**: On-time delivery rates, scheduled vs actual delivery dates, and shipment delay metrics.
