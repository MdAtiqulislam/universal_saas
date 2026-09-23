# Milestone M11: Customers & Sales Order Management — Implementation Report

## 1. Executive Summary

Milestone **M11 — Customers & Sales Order Management** has been implemented, tested, and verified according to architectural requirements. This milestone establishes the complete sales lifecycle engine for the **Universal Business Operations SaaS** platform, incorporating customer master management, pricing overrides, quotations, sales order reservation mechanics, and warehouse fulfillment integration.

---

## 2. Key Accomplishments

### 2.1 Customer Master & Contacts

- Multi-tenant customer profiles (`Customer`) with payment terms, credit limits, tax numbers, and groups.
- `CustomerGroup` for customer classification and group-based pricing.
- `CustomerContact` with designation, email, phone, and unique primary contact per customer.
- `CustomerAddress` supporting multiple address categories (`BILLING`, `SHIPPING`, `HEADQUARTERS`, etc.) with primary flag management.

### 2.2 Customer-Specific Pricing Engine

- `CustomerPrice` model with PostgreSQL check constraints enforcing target XORs (Customer vs CustomerGroup, Item vs ItemVariant).
- Minimum quantity volume tiers and time-based validity windows (`validFrom`, `validUntil`).

### 2.3 Quotation Management & Conversion

- Full lifecycle: `DRAFT` $\to$ `SENT` $\to$ `ACCEPTED` / `REJECTED` / `EXPIRED` / `CANCELLED`.
- Idempotent one-click conversion (`convert()`) from `ACCEPTED` quotation to `DRAFT` sales order with line copying and audit events.
- Auto-numbering sequence `QT-000001`.

### 2.4 Sales Orders & Inventory Reservation

- Sales order state machine: `DRAFT` $\to$ `CONFIRMED` $\to$ `PARTIALLY_RESERVED` / `RESERVED` $\to$ `PARTIALLY_DELIVERED` / `DELIVERED` $\to$ `CLOSED` (or `CANCELLED`).
- Atomic stock reservation upon order confirmation: checks physical available stock ($\text{Available} = \text{OnHand} - \text{Reserved}$) and creates `InventoryReservation` rows.
- Concurrency-safe reservation under parallel sales order confirmations.
- Automatic reservation release upon sales order cancellation.
- Auto-numbering sequence `SO-000001`.

### 2.5 Delivery Orders & Inventory Integration

- Fulfillment workflow: `DRAFT` $\to$ `READY` $\to$ `PICKED` $\to$ `SHIPPED` $\to$ `DELIVERED` (or `CANCELLED`).
- Integrated with M09 `BalancesService.applyStockMovement` using `StockMovementType.ISSUE`.
- Support for batch and serial tracking during delivery.
- Automatic fulfillment and consumption of active `InventoryReservation` records.
- Auto-numbering sequence `DO-000001`.

---

## 3. Database Schema & Migration

- **Migration**: `apps/api/prisma/migrations/20260828000600_add_sales/migration.sql`
- **Models**:
  - `CustomerGroup`
  - `Customer`
  - `CustomerContact`
  - `CustomerAddress`
  - `CustomerPrice`
  - `Quotation`
  - `QuotationLine`
  - `SalesOrder`
  - `SalesOrderLine`
  - `InventoryReservation`
  - `DeliveryOrder`
  - `DeliveryOrderLine`
- **Enums**: `CustomerAddressType`, `QuotationStatus`, `SalesOrderStatus`, `ReservationStatus`, `DeliveryOrderStatus`.
- **Check Constraints**: Enforced non-negative quantities, price constraints, target XOR constraints, and progression invariants (`quantity_delivered <= quantity_reserved <= quantity`).

---

## 4. Test Suite Summary

- **Total Test Suites**: 58 passed (all 58 suites green)
- **Total Tests**: 376 passed (all 376 tests green)
- **M11 Sales Test Suites**:
  1. `apps/api/src/sales/groups/customer-groups.service.spec.ts` (5 tests)
  2. `apps/api/src/sales/customers/customers.service.spec.ts` (6 tests)
  3. `apps/api/src/sales/contacts/customer-contacts.service.spec.ts` (4 tests)
  4. `apps/api/src/sales/addresses/customer-addresses.service.spec.ts` (4 tests)
  5. `apps/api/src/sales/pricing/customer-pricing.service.spec.ts` (8 tests)
  6. `apps/api/src/sales/quotations/quotations.service.spec.ts` (7 tests)
  7. `apps/api/src/sales/orders/sales-orders.service.spec.ts` (6 tests)
  8. `apps/api/src/sales/reservations/reservations.service.spec.ts` (3 tests)
  9. `apps/api/src/sales/deliveries/delivery-orders.service.spec.ts` (7 tests)
  10. `apps/api/src/sales/tenant-sales-isolation.spec.ts` (10 tests)
  11. `apps/api/src/sales/sales-concurrency.spec.ts` (1 test)
  12. `apps/api/src/prisma/database-invariants.spec.ts` (tests 29-33)

---

## 5. Architectural Decision Records (ADRs)

- **ADR-017**: Sales Order State Machine and Lifecycle Transitions
- **ADR-018**: Inventory Reservation and Concurrency Protection Strategy
- **ADR-019**: Delivery Orders and Inventory Ledger Integration
