# Milestone M18 — Credit Notes, Debit Notes & Refunds Specification

## 1. Executive Summary

Milestone **M18 — Credit Notes, Debit Notes & Refunds Foundation** provides an institutional-grade, multi-tenant financial adjustment and settlement engine. It seamlessly extends the Universal SaaS platform by integrating Accounts Receivable (M14), Accounts Payable (M13), Payments & Settlement (M15), Inventory & Warehouse (M09), General Ledger Accounting (M12), Master Data & Numbering (M07), and RBAC Security (M05).

---

## 2. Core Capabilities

### 2.1 Customer Credit Notes

- **Lifecycle State Machine**: `DRAFT` $\to$ `APPROVED` $\to$ `POSTED` $\to$ `PARTIALLY_APPLIED` $\to$ `APPLIED` / `VOIDED`.
- **Line-Level Calculations**: Decimal arithmetic (`DECIMAL(18, 4)` / `DECIMAL(20, 4)`) computing unit prices, line discounts, tax rates, line taxes, and line totals.
- **Double-Entry GL Posting**:
  - Debit: `SALES_RETURNS` (or `SALES_REVENUE`)
  - Debit: `OUTPUT_TAX` (tax reduction)
  - Credit: `ACCOUNTS_RECEIVABLE` (customer balance credit)
- **Settlement & Application**:
  - Apply credit balance against open Customer Invoices (`ISSUED`, `PARTIALLY_PAID`).
  - Decrements `invoice.amountDue`, increments `invoice.amountPaid`.
  - Auto-transitions invoices to `PAID` when fully cleared.

### 2.2 Customer Refunds

- **Lifecycle**: `DRAFT` $\to$ `POSTED` $\to$ `VOIDED`.
- **Integration**: Linked to `CustomerCreditNote` and `PaymentAccount` (Bank / Cash).
- **Double-Entry GL Posting**:
  - Debit: `ACCOUNTS_RECEIVABLE` (clearing credit note balance)
  - Credit: `PaymentAccount.accountingAccountId` (cash outflow)
- **Reversal Support**: Voiding posted refund produces a balanced compensating journal entry and restores credit note available balance.

### 2.3 Supplier Debit Notes

- **Lifecycle State Machine**: `DRAFT` $\to$ `APPROVED` $\to$ `POSTED` $\to$ `PARTIALLY_APPLIED` $\to$ `APPLIED` / `VOIDED`.
- **Double-Entry GL Posting**:
  - Debit: `ACCOUNTS_PAYABLE` (reducing liability to supplier)
  - Credit: `PURCHASE_EXPENSE` (or `INVENTORY_ASSET`)
  - Credit: `INPUT_TAX` (tax credit reduction)
- **Settlement & Application**:
  - Apply debit against open Supplier Invoices (`POSTED`, `PARTIALLY_PAID`).
  - Decrements `invoice.amountDue`, increments `invoice.amountPaid`.
  - Transitions invoice to `PAID` upon complete settlement.

### 2.4 Inventory Return Integration

- **Restock Movements**: When credit note items specify `returnToInventory: true` with `disposition: RESTOCK`, atomic stock movement (`StockMovementType.RECEIPT`) is applied at the designated warehouse location using M09 `BalancesService`.
- **Vendor Return Movements**: When debit note items specify `returnToInventory: true`, stock movement (`StockMovementType.ISSUE`) is executed against warehouse inventory balances.

---

## 3. Database Schema Design

- `CustomerCreditNote` & `CustomerCreditNoteLine`
- `CustomerCreditApplication`
- `CustomerRefund`
- `SupplierDebitNote` & `SupplierDebitNoteLine`
- `SupplierDebitApplication`

All entities enforce tenant isolation via `organizationId`, soft delete safeguards (`deletedAt`), precise decimal columns, and audit user references.

---

## 4. API Endpoints

### Customer Credit Notes

- `GET /api/v1/sales/credit-notes` (`sales.credit-notes.view`)
- `POST /api/v1/sales/credit-notes` (`sales.credit-notes.manage`)
- `GET /api/v1/sales/credit-notes/:id` (`sales.credit-notes.view`)
- `PATCH /api/v1/sales/credit-notes/:id` (`sales.credit-notes.manage`)
- `POST /api/v1/sales/credit-notes/:id/approve` (`sales.credit-notes.approve`)
- `POST /api/v1/sales/credit-notes/:id/post` (`sales.credit-notes.post`)
- `POST /api/v1/sales/credit-notes/:id/apply` (`sales.credit-notes.apply`)
- `POST /api/v1/sales/credit-notes/:id/void` (`sales.credit-notes.void`)

### Customer Refunds

- `GET /api/v1/sales/refunds` (`sales.refunds.view`)
- `POST /api/v1/sales/refunds` (`sales.refunds.manage`)
- `GET /api/v1/sales/refunds/:id` (`sales.refunds.view`)
- `POST /api/v1/sales/refunds/:id/post` (`sales.refunds.post`)
- `POST /api/v1/sales/refunds/:id/void` (`sales.refunds.void`)

### Supplier Debit Notes

- `GET /api/v1/purchasing/debit-notes` (`purchasing.debit-notes.view`)
- `POST /api/v1/purchasing/debit-notes` (`purchasing.debit-notes.manage`)
- `GET /api/v1/purchasing/debit-notes/:id` (`purchasing.debit-notes.view`)
- `PATCH /api/v1/purchasing/debit-notes/:id` (`purchasing.debit-notes.manage`)
- `POST /api/v1/purchasing/debit-notes/:id/approve` (`purchasing.debit-notes.approve`)
- `POST /api/v1/purchasing/debit-notes/:id/post` (`purchasing.debit-notes.post`)
- `POST /api/v1/purchasing/debit-notes/:id/apply` (`purchasing.debit-notes.apply`)
- `POST /api/v1/purchasing/debit-notes/:id/void` (`purchasing.debit-notes.void`)
