# M09 — Inventory & Warehouse Management Architecture Guide

This document defines the inventory management architecture, stock balance tracking, immutable movement ledgers, batch/serial tracking, inventory adjustments, and internal location transfers established in **Milestone M09**.

---

## 1. Inventory Engine Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INVENTORY & WAREHOUSE MANAGEMENT                         │
├──────────────────────────────────────┬──────────────────────────────────────┤
│          STOCK LEDGER & BALANCES     │       TRACKING & TRANSFERS           │
├──────────────────────────────────────┼──────────────────────────────────────┤
│  • InventoryBalance (on-hand/resv)   │  • InventoryBatch (lot/expiry date)  │
│  • StockMovement (immutable ledger)  │  • InventorySerial (individual SN)   │
│  • Controlled Adjustments (in/out)   │  • StockTransfer (multi-location)    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Models & Data Structures

### 2.1 InventoryBalance (`inventory_balances`)

- Tenant-scoped stock balance for an item / variant at a physical location.
- Fields: `organizationId`, `locationId`, `itemId`, `variantId`, `quantityOnHand`, `quantityReserved`.
- Composite Unique: `UNIQUE(organization_id, location_id, item_id, variant_id)`.
- Available calculation: $\text{Available} = \text{quantityOnHand} - \text{quantityReserved}$.
- Database Constraint: `CHECK ("quantity_on_hand" >= 0)` and `CHECK ("quantity_reserved" >= 0)`.

### 2.2 StockMovement (`stock_movements`)

- Immutable, append-only transaction ledger recording every stock mutation.
- Fields: `organizationId`, `locationId`, `itemId`, `variantId`, `movementType`, `quantity`, `batchId`, `serialId`, `referenceType`, `referenceId`, `reason`, `actorUserId`, `createdAt`.
- `StockMovementType`: `RECEIPT`, `ISSUE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`.
- Database Constraint: `CHECK ("quantity" > 0)`.

### 2.3 InventoryBatch (`inventory_batches`)

- Tracks manufactured date, expiry date, and current quantity for `TrackingType.BATCH` items.
- Composite Unique: `UNIQUE(organization_id, item_id, variant_id, location_id, batch_number)`.
- Synchronized automatically upon stock receipts, issues, adjustments, and transfers.

### 2.4 InventorySerial (`inventory_serials`)

- Tracks unique physical serial numbers for `TrackingType.SERIAL` items.
- Status: `AVAILABLE`, `RESERVED`, `SOLD`, `DAMAGED`, `LOST`, `TRANSFERRED`.
- Enforces movement quantity = 1 and location synchronization.

### 2.5 StockTransfer (`stock_transfers`)

- Controlled two-phase stock movement between distinct locations within the same tenant.
- Atomically executes `TRANSFER_OUT` from source location and `TRANSFER_IN` to destination location upon completion.

---

## 3. REST API Specification

| Resource        | Method  | Path                                       | Permission                     | Description                                                              |
| :-------------- | :------ | :----------------------------------------- | :----------------------------- | :----------------------------------------------------------------------- |
| **Balances**    | `GET`   | `/api/v1/inventory/balances`               | `inventory.balances.view`      | List stock balances with availability and filters                        |
|                 | `GET`   | `/api/v1/inventory/balances/:itemId`       | `inventory.balances.view`      | Get all location balances for an item                                    |
| **Movements**   | `GET`   | `/api/v1/inventory/movements`              | `inventory.movements.view`     | Query immutable stock movements ledger                                   |
|                 | `GET`   | `/api/v1/inventory/movements/:id`          | `inventory.movements.view`     | Get single stock movement by ID                                          |
| **Adjustments** | `POST`  | `/api/v1/inventory/adjustments`            | `inventory.adjustments.manage` | Execute controlled stock adjustment (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`) |
| **Batches**     | `GET`   | `/api/v1/inventory/batches`                | `inventory.batches.view`       | List batches (with search & expired filters)                             |
|                 | `GET`   | `/api/v1/inventory/batches/:id`            | `inventory.batches.view`       | Get batch by ID                                                          |
|                 | `POST`  | `/api/v1/inventory/batches`                | `inventory.batches.manage`     | Create new batch (with optional initial stock receipt)                   |
|                 | `PATCH` | `/api/v1/inventory/batches/:id`            | `inventory.batches.manage`     | Update batch manufactured/expiry dates                                   |
| **Serials**     | `GET`   | `/api/v1/inventory/serials`                | `inventory.serials.view`       | List serials (with status and search filters)                            |
|                 | `GET`   | `/api/v1/inventory/serials/:id`            | `inventory.serials.view`       | Get serial by ID                                                         |
|                 | `POST`  | `/api/v1/inventory/serials`                | `inventory.serials.manage`     | Register serial (with optional initial receipt)                          |
|                 | `PATCH` | `/api/v1/inventory/serials/:id`            | `inventory.serials.manage`     | Update serial lifecycle status                                           |
| **Transfers**   | `GET`   | `/api/v1/inventory/transfers`              | `inventory.transfers.view`     | List stock transfers                                                     |
|                 | `GET`   | `/api/v1/inventory/transfers/:id`          | `inventory.transfers.view`     | Get stock transfer by ID                                                 |
|                 | `POST`  | `/api/v1/inventory/transfers`              | `inventory.transfers.manage`   | Create transfer in DRAFT status                                          |
|                 | `POST`  | `/api/v1/inventory/transfers/:id/complete` | `inventory.transfers.manage`   | Atomically complete transfer and move stock                              |
|                 | `POST`  | `/api/v1/inventory/transfers/:id/cancel`   | `inventory.transfers.manage`   | Cancel DRAFT transfer                                                    |

---

## 4. Audit & Event Integration

Operations emit domain events to the internal `EventBusService`:

- `STOCK_RECEIVED`, `STOCK_ISSUED`, `INVENTORY_ADJUSTED`
- `STOCK_TRANSFER_CREATED`, `STOCK_TRANSFER_COMPLETED`, `STOCK_TRANSFER_CANCELLED`
- `BATCH_CREATED`, `BATCH_UPDATED`
- `SERIAL_CREATED`, `SERIAL_STATUS_CHANGED`
