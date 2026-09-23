# M10 — Suppliers & Purchasing Management Architecture Guide

This document defines the architecture, data models, state machine, goods receipt execution, and inventory integration established in **Milestone M10**.

---

## 1. Overview & Architectural Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SUPPLIERS & PURCHASING MANAGEMENT                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│         SUPPLIERS & COMMERCIALS      │       RECEIVING & LANDED COSTS       │
├──────────────────────────────────────┼──────────────────────────────────────┤
│  • Supplier profiles & terms         │  • GoodsReceipts (draft & post)      │
│  • Contacts (primary designation)    │  • M09 BalancesService integration   │
│  • Addresses (billing / shipping)    │  • Batch / serial receiving          │
│  • PurchaseOrder (lifecycle FSM)     │  • PurchaseCostAllocation foundation │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Models & Data Structures

### 2.1 Supplier (`suppliers`)

- Tenant-scoped vendor master record.
- Fields: `organizationId`, `code`, `name`, `legalName`, `taxNumber`, `email`, `phone`, `currencyId`, `paymentTermsDays`, `notes`, `isActive`, `deletedAt`.
- Composite Unique: `UNIQUE(organization_id, code)`.
- Database Constraint: `CHECK ("payment_terms_days" >= 0)`.

### 2.2 SupplierContact & SupplierAddress (`supplier_contacts`, `supplier_addresses`)

- Multiple contacts per supplier; single primary contact enforced transactionally.
- Multiple addresses categorized by `SupplierAddressType` (`BILLING`, `SHIPPING`, `OTHER`); single primary per type.

### 2.3 PurchaseOrder & PurchaseOrderLine (`purchase_orders`, `purchase_order_lines`)

- Tenant-scoped order with sequential auto-numbering (`PO-000001` via `NumberingService`).
- Fields: `organizationId`, `poNumber`, `supplierId`, `locationId`, `currencyId`, `status`, `subtotal`, `discountTotal`, `taxTotal`, `shippingTotal`, `grandTotal`, `createdByUserId`, `approvedByUserId`, `approvedAt`.
- Purchase Order Lifecycle: `DRAFT` -> `SUBMITTED` -> `APPROVED` -> `PARTIALLY_RECEIVED` -> `RECEIVED` -> `CLOSED` (or `CANCELLED`).
- Invariant: `received_quantity <= quantity` enforced at application and database constraint level.

### 2.4 GoodsReceipt & GoodsReceiptLine (`goods_receipts`, `goods_receipt_lines`)

- Inbound physical shipment tracking against approved purchase orders.
- Status: `DRAFT` -> `POSTED` (or `CANCELLED`).
- Posting executes atomic `BalancesService.applyStockMovement()` with `StockMovementType.RECEIPT`, updates PO received quantities, and recalculates PO status.

### 2.5 PurchaseCostAllocation (`purchase_cost_allocations`)

- Records auxiliary landed expenses (`SHIPPING`, `CUSTOMS`, `DUTY`, `INSURANCE`, `HANDLING`, `OTHER`) linked to purchase orders or goods receipts with allocation method (`BY_VALUE`, `BY_QUANTITY`, `BY_WEIGHT`, `EQUAL`).

---

## 3. REST API Specification

| Resource      | Method   | Path                                         | Permission                    | Description                                        |
| :------------ | :------- | :------------------------------------------- | :---------------------------- | :------------------------------------------------- |
| **Suppliers** | `GET`    | `/api/v1/suppliers`                          | `purchasing.suppliers.view`   | List suppliers (pagination, search, active filter) |
|               | `GET`    | `/api/v1/suppliers/:id`                      | `purchasing.suppliers.view`   | Get supplier details with contacts & addresses     |
|               | `POST`   | `/api/v1/suppliers`                          | `purchasing.suppliers.manage` | Create new supplier                                |
|               | `PATCH`  | `/api/v1/suppliers/:id`                      | `purchasing.suppliers.manage` | Update supplier profile                            |
|               | `DELETE` | `/api/v1/suppliers/:id`                      | `purchasing.suppliers.manage` | Soft-delete supplier                               |
| **Contacts**  | `GET`    | `/api/v1/suppliers/:id/contacts`             | `purchasing.suppliers.view`   | List contacts for supplier                         |
|               | `POST`   | `/api/v1/suppliers/:id/contacts`             | `purchasing.suppliers.manage` | Add contact to supplier                            |
|               | `PATCH`  | `/api/v1/suppliers/:id/contacts/:contactId`  | `purchasing.suppliers.manage` | Update supplier contact                            |
|               | `DELETE` | `/api/v1/suppliers/:id/contacts/:contactId`  | `purchasing.suppliers.manage` | Remove supplier contact                            |
| **Addresses** | `GET`    | `/api/v1/suppliers/:id/addresses`            | `purchasing.suppliers.view`   | List addresses for supplier                        |
|               | `POST`   | `/api/v1/suppliers/:id/addresses`            | `purchasing.suppliers.manage` | Add address to supplier                            |
|               | `PATCH`  | `/api/v1/suppliers/:id/addresses/:addressId` | `purchasing.suppliers.manage` | Update supplier address                            |
|               | `DELETE` | `/api/v1/suppliers/:id/addresses/:addressId` | `purchasing.suppliers.manage` | Remove supplier address                            |
| **Orders**    | `GET`    | `/api/v1/purchase-orders`                    | `purchasing.orders.view`      | List purchase orders                               |
|               | `GET`    | `/api/v1/purchase-orders/:id`                | `purchasing.orders.view`      | Get purchase order with lines & receipts           |
|               | `POST`   | `/api/v1/purchase-orders`                    | `purchasing.orders.manage`    | Create draft purchase order                        |
|               | `PATCH`  | `/api/v1/purchase-orders/:id`                | `purchasing.orders.manage`    | Update draft purchase order                        |
|               | `POST`   | `/api/v1/purchase-orders/:id/submit`         | `purchasing.orders.submit`    | Submit draft purchase order                        |
|               | `POST`   | `/api/v1/purchase-orders/:id/approve`        | `purchasing.orders.approve`   | Managerially approve purchase order                |
|               | `POST`   | `/api/v1/purchase-orders/:id/cancel`         | `purchasing.orders.cancel`    | Cancel purchase order                              |
|               | `POST`   | `/api/v1/purchase-orders/:id/close`          | `purchasing.orders.manage`    | Close fully received purchase order                |
| **Receipts**  | `GET`    | `/api/v1/goods-receipts`                     | `purchasing.receipts.view`    | List goods receipts                                |
|               | `GET`    | `/api/v1/goods-receipts/:id`                 | `purchasing.receipts.view`    | Get goods receipt details                          |
|               | `POST`   | `/api/v1/goods-receipts`                     | `purchasing.receipts.manage`  | Create draft goods receipt                         |
|               | `POST`   | `/api/v1/goods-receipts/:id/post`            | `purchasing.receipts.post`    | Post receipt & receive stock into inventory        |
|               | `POST`   | `/api/v1/goods-receipts/:id/cancel`          | `purchasing.receipts.cancel`  | Cancel draft goods receipt                         |
| **Costs**     | `GET`    | `/api/v1/purchase-costs`                     | `purchasing.costs.view`       | List landed cost allocations                       |
|               | `GET`    | `/api/v1/purchase-costs/:id`                 | `purchasing.costs.view`       | Get single cost allocation                         |
|               | `POST`   | `/api/v1/purchase-costs`                     | `purchasing.costs.manage`     | Create landed cost record                          |
|               | `PATCH`  | `/api/v1/purchase-costs/:id`                 | `purchasing.costs.manage`     | Update landed cost record                          |

---

## 4. Audit & Event Integration

Operations emit domain events to `EventBusService`:

- `SUPPLIER_CREATED`, `SUPPLIER_UPDATED`, `SUPPLIER_DEACTIVATED`, `SUPPLIER_DELETED`
- `SUPPLIER_CONTACT_CREATED`, `SUPPLIER_CONTACT_UPDATED`, `SUPPLIER_CONTACT_DELETED`
- `SUPPLIER_ADDRESS_CREATED`, `SUPPLIER_ADDRESS_UPDATED`, `SUPPLIER_ADDRESS_DELETED`
- `PURCHASE_ORDER_CREATED`, `PURCHASE_ORDER_UPDATED`, `PURCHASE_ORDER_SUBMITTED`, `PURCHASE_ORDER_APPROVED`, `PURCHASE_ORDER_CANCELLED`, `PURCHASE_ORDER_CLOSED`
- `GOODS_RECEIPT_CREATED`, `GOODS_RECEIPT_POSTED`, `GOODS_RECEIPT_CANCELLED`
- `PURCHASE_COST_CREATED`, `PURCHASE_COST_UPDATED`
