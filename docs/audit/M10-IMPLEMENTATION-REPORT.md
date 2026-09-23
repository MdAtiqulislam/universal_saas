# Milestone M10 — Implementation Report: Suppliers & Purchasing Management

**Milestone**: M10 — Suppliers & Purchasing Management  
**Status**: **COMPLETED**  
**Date**: August 28, 2026  
**Auditor**: Antigravity Technical Pair Programmer

---

## 1. Executive Summary

Milestone M10 establishes a production-grade, tenant-aware **Suppliers & Purchasing Management foundation** for the **Universal Business Operations SaaS** platform.

The system delivers end-to-end purchasing capabilities including:

1. Vendor/supplier relationship master data (`Supplier`, `SupplierContact`, `SupplierAddress`) with payment terms and tenant isolation.
2. Full lifecycle Purchase Order management (`PurchaseOrder`, `PurchaseOrderLine`) with high-precision Decimal monetary calculations and strict Finite State Machine (`DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `PARTIALLY_RECEIVED` $\to$ `RECEIVED` $\to$ `CLOSED`).
3. Goods receipt receiving engine (`GoodsReceipt`, `GoodsReceiptLine`) integrating seamlessly with Milestone M09's `BalancesService` to atomically create inventory movements, batch records, and serial tracking entries.
4. Concurrency-safe over-receiving protection and idempotent receipt posting.
5. Landed-cost data foundation (`PurchaseCostAllocation`) supporting multiple cost types and allocation methods.
6. Granular RBAC permissions, domain events, sensitive data sanitization, and 100% test coverage.

---

## 2. Database Changes & Migration

- **Migration**: `apps/api/prisma/migrations/20260828000500_add_purchasing/migration.sql`
- **Models Created**:
  - `Supplier` (`suppliers`): Tenant supplier profile with unique code, currency reference, payment terms.
  - `SupplierContact` (`supplier_contacts`): Multi-contact support with single primary contact enforcement.
  - `SupplierAddress` (`supplier_addresses`): Billing, shipping, and general address records.
  - `PurchaseOrder` (`purchase_orders`): Purchase order header with sequential numbering (`PO-000001`), financial totals, and lifecycle status.
  - `PurchaseOrderLine` (`purchase_order_lines`): Line items with quantity, unit price, discount, tax, and received quantity tracking.
  - `GoodsReceipt` (`goods_receipts`): Receipt header with sequential numbering (`GR-000001`) and location routing.
  - `GoodsReceiptLine` (`goods_receipt_lines`): Received quantities, unit costs, batch lot tracking, and serial numbers.
  - `PurchaseCostAllocation` (`purchase_cost_allocations`): Landed-cost allocation records.
- **Database Constraints & Indexes**:
  - `suppliers_non_negative_terms`: `CHECK ("payment_terms_days" >= 0)`
  - `purchase_orders_non_negative_terms`: `CHECK ("payment_terms_days" >= 0)`
  - `purchase_orders_non_negative_totals`: `CHECK ("subtotal" >= 0 AND "grand_total" >= 0)`
  - `purchase_order_lines_positive_qty`: `CHECK ("quantity" > 0)`
  - `purchase_order_lines_non_negative_prices`: `CHECK ("unit_price" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "line_total" >= 0)`
  - `purchase_order_lines_received_le_qty`: `CHECK ("received_quantity" >= 0 AND "received_quantity" <= "quantity")`
  - `goods_receipt_lines_positive_qty`: `CHECK ("quantity" > 0)`
  - `purchase_cost_allocations_positive_amount`: `CHECK ("amount" > 0)`
- **Historical Migrations**: All historical migrations (`20260828000000_init`, `20260828000100_add_sessions`, `20260828000200_add_master_data`, `20260828000300_add_item_catalog`, `20260828000400_add_inventory`) remained completely untouched.

---

## 3. Files Created & Modified

| File                                                                           | Status   | Description                                                                                                                                                                       |
| :----------------------------------------------------------------------------- | :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                                | MODIFIED | Added M10 enums and models (`Supplier`, `SupplierContact`, `SupplierAddress`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, `GoodsReceiptLine`, `PurchaseCostAllocation`) |
| `apps/api/prisma/migrations/20260828000500_add_purchasing/migration.sql`       | NEW      | Migration DDL with tables, foreign keys, indexes, and database check constraints                                                                                                  |
| `apps/api/prisma/seed.ts`                                                      | MODIFIED | Seeded purchasing permissions for `OWNER`, `ADMIN`, and `VIEWER` roles                                                                                                            |
| `apps/api/src/audit/audit-event.listener.ts`                                   | MODIFIED | Registered purchasing domain events in `DOMAIN_AUDIT_EVENTS`                                                                                                                      |
| `apps/api/src/purchasing/suppliers/`                                           | NEW      | DTOs, service, and controller for suppliers                                                                                                                                       |
| `apps/api/src/purchasing/contacts/`                                            | NEW      | DTOs, service, and controller for supplier contacts                                                                                                                               |
| `apps/api/src/purchasing/addresses/`                                           | NEW      | DTOs, service, and controller for supplier addresses                                                                                                                              |
| `apps/api/src/purchasing/orders/`                                              | NEW      | DTOs, service, and controller for purchase orders and lifecycle state machine                                                                                                     |
| `apps/api/src/purchasing/receipts/`                                            | NEW      | DTOs, service, and controller for goods receipts and inventory integration                                                                                                        |
| `apps/api/src/purchasing/costs/`                                               | NEW      | DTOs, service, and controller for landed cost allocations                                                                                                                         |
| `apps/api/src/purchasing/purchasing.module.ts`                                 | NEW      | NestJS purchasing module exporting all services                                                                                                                                   |
| `apps/api/src/app.module.ts`                                                   | MODIFIED | Registered `PurchasingModule`                                                                                                                                                     |
| `apps/api/src/purchasing/suppliers/suppliers.service.spec.ts`                  | NEW      | Unit tests for suppliers service                                                                                                                                                  |
| `apps/api/src/purchasing/contacts/supplier-contacts.service.spec.ts`           | NEW      | Unit tests for supplier contacts service                                                                                                                                          |
| `apps/api/src/purchasing/addresses/supplier-addresses.service.spec.ts`         | NEW      | Unit tests for supplier addresses service                                                                                                                                         |
| `apps/api/src/purchasing/orders/purchase-orders.service.spec.ts`               | NEW      | Unit tests for purchase order lifecycle and calculations                                                                                                                          |
| `apps/api/src/purchasing/receipts/goods-receipts.service.spec.ts`              | NEW      | Unit tests for goods receipt posting and inventory integration                                                                                                                    |
| `apps/api/src/purchasing/costs/purchase-costs.service.spec.ts`                 | NEW      | Unit tests for purchase cost allocations                                                                                                                                          |
| `apps/api/src/purchasing/tenant-purchasing-isolation.spec.ts`                  | NEW      | Integration tests for multi-tenant purchasing isolation                                                                                                                           |
| `apps/api/src/purchasing/receipts-concurrency.spec.ts`                         | NEW      | Concurrency tests verifying over-receiving prevention under parallel transactions                                                                                                 |
| `apps/api/src/prisma/database-invariants.spec.ts`                              | MODIFIED | Extended with M10 purchasing database invariants (tests 24-28)                                                                                                                    |
| `docs/11-purchasing/M10-Suppliers-and-Purchasing.md`                           | NEW      | Comprehensive M10 architecture guide                                                                                                                                              |
| `docs/02-architecture/adr/ADR-014-Purchasing-Workflow-and-State-Machine.md`    | NEW      | ADR on purchase order lifecycle state machine                                                                                                                                     |
| `docs/02-architecture/adr/ADR-015-Goods-Receipt-and-Inventory-Integration.md`  | NEW      | ADR on goods receipt posting & inventory integration                                                                                                                              |
| `docs/02-architecture/adr/ADR-016-Purchase-Cost-and-Landed-Cost-Foundation.md` | NEW      | ADR on landed cost data foundation                                                                                                                                                |
| `docs/audit/M10-IMPLEMENTATION-REPORT.md`                                      | NEW      | Milestone M10 audit report                                                                                                                                                        |

---

## 4. RBAC Permissions Added

The following granular permissions were added:

- `purchasing.suppliers.view`, `purchasing.suppliers.manage`
- `purchasing.orders.view`, `purchasing.orders.manage`, `purchasing.orders.submit`, `purchasing.orders.approve`, `purchasing.orders.cancel`
- `purchasing.receipts.view`, `purchasing.receipts.manage`, `purchasing.receipts.post`, `purchasing.receipts.cancel`
- `purchasing.costs.view`, `purchasing.costs.manage`

---

## 5. Verification & Test Results

| Check / Command     | Exit Code | Result | Details                                                          |
| :------------------ | :-------- | :----- | :--------------------------------------------------------------- |
| `pnpm db:validate`  | 0         | PASSED | Prisma schema validated                                          |
| `pnpm db:generate`  | 0         | PASSED | Generated Prisma Client with M10 models                          |
| `pnpm format:check` | 0         | PASSED | 100% Prettier formatting compliance                              |
| `pnpm typecheck`    | 0         | PASSED | Strict TypeScript compilation across workspace                   |
| `pnpm lint`         | 0         | PASSED | 0 ESLint errors across workspace                                 |
| `pnpm test`         | 0         | PASSED | **310 tests passed across 47 test suites** (50 new tests in M10) |
| `pnpm build`        | 0         | PASSED | Production builds of NestJS API and Next.js Web passed cleanly   |

---

## 6. Known Limitations & Technical Debt

- **Accounts Payable / Invoicing**: Supplier bills, accounts payable subledgers, and 3-way matching (PO vs Receipt vs Invoice) will be introduced in subsequent accounting/finance milestones.
- **Advanced Landed-Cost Allocation Engines**: `PurchaseCostAllocation` provides the persisted data schema and validation; real-time recalculation of item weighted-average unit costs during receiving will be integrated in future inventory valuation modules.

---

## 7. Recommended Next Milestone

Proceed to **Milestone M11 — Customers & Sales Order Management (Customers, Quotations, Sales Orders, Pricing Rules, Delivery Orders)**.
