# Milestone M14: Accounts Receivable & Customer Invoicing — Implementation Report

## 1. Executive Summary

Milestone **M14 — Accounts Receivable & Customer Invoicing** has been implemented, verified, and integrated into the **Universal Business Operations SaaS** platform. This milestone establishes customer invoice management, line-level pricing/tax calculations, Sales Order and Delivery Order conversions, tenant AR balance and aging analysis, and general ledger double-entry journal postings into M12.

---

## 2. Key Accomplishments

### 2.1 Accounts Receivable Account Mapping

- Reused and extended `AccountingAccountMapping` for AR keys (`ACCOUNTS_RECEIVABLE`, `SALES_REVENUE`, `OUTPUT_TAX`, `SALES_DISCOUNT`).
- Tenant isolation and validation ensuring accounts are active and non-deleted.

### 2.2 Customer Invoices & Lines (`CustomerInvoice`, `CustomerInvoiceLine`)

- Numbering sequence generation: `CI-000001`.
- Exact decimal monetary calculations (`subtotal`, `discountAmount`, `taxAmount`, `grandTotal`, `amountPaid`, `amountDue`).
- Automated due date calculation using customer/sales order `paymentTermsDays`.
- Line constraints: `quantity > 0`, `unit_price >= 0`, `discount_amount >= 0`, `tax_amount >= 0`, `line_total >= 0`.
- Database invariant: $\text{amount\_due} = \text{grand\_total} - \text{amount\_paid}$.

### 2.3 Sales Order & Delivery Order Conversions

- `createFromSalesOrder`: Converts unbilled line quantities from confirmed sales orders into draft invoices.
- `createFromDeliveryOrder`: Invoices delivered items directly from completed delivery orders.

### 2.4 General Ledger Accounting Integration

- Transactional posting generating balanced M12 journal entries:
  - **Debit**: Accounts Receivable (`grandTotal`)
  - **Credit**: Sales Revenue (`subtotal - discountAmount`)
  - **Credit**: Output Tax (`taxAmount`, if $> 0$)
- Immutability enforcement: issued invoices cannot be directly modified.
- Compensating reversal workflow on `void()`.

### 2.5 AR Balances & Aging Analysis

- Real-time customer balance calculations (`totalInvoiced`, `totalPaid`, `totalDue`, `overdueAmount`).
- AR aging report categorization across `Current`, `1–30 days`, `31–60 days`, `61–90 days`, and `90+ days` buckets.

---

## 3. Database Schema & Migration

- **Migration File**: `apps/api/prisma/migrations/20260828000900_add_accounts_receivable/migration.sql`
- **Models**:
  - `CustomerInvoice`
  - `CustomerInvoiceLine`
- **Enums**: `CustomerInvoiceStatus`
- **Check Constraints**:
  - `chk_customer_invoice_totals`: `grand_total >= 0 AND amount_paid >= 0 AND amount_due >= 0`
  - `chk_customer_invoice_due_balance`: `amount_due = grand_total - amount_paid`
  - `chk_customer_invoice_line_qty`: `quantity > 0`
  - `chk_customer_invoice_line_amounts`: `unit_price >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0`
  - `customer_invoices_organization_id_invoice_number_key`: `UNIQUE(organization_id, invoice_number)`

---

## 4. Test Suite Summary

- **Total Test Suites**: 76 passed (all 76 suites green)
- **Total Tests**: 492 passed (all 492 tests green)
- **M14 Accounts Receivable Test Suites**:
  1. `apps/api/src/ar/invoices/customer-invoices.service.spec.ts` (9 tests)
  2. `apps/api/src/ar/receivables/receivables.service.spec.ts` (3 tests)
  3. `apps/api/src/ar/tenant-ar-isolation.spec.ts` (10 tests)
  4. `apps/api/src/ar/ar-concurrency.spec.ts` (2 tests)
  5. `apps/api/src/ar/ar-integrity.spec.ts` (1 test)
  6. `apps/api/src/prisma/database-invariants.spec.ts` (tests 42-45)

---

## 5. Architectural Decision Records (ADRs)

- **ADR-025**: Customer Invoice Lifecycle and Source Document Conversions
- **ADR-026**: Accounts Receivable Balance and Aging Bucketing Strategy
- **ADR-027**: Customer Invoicing General Ledger Posting and Compensating Reversals

---

## 6. Known Limitations & Recommended Next Milestone

- **Known Limitations**: Customer payment receipts, payment allocations against open invoices, credit notes, and multi-currency exchange rate adjustments will be implemented in subsequent settlement milestones.
- **Recommended Next Milestone**: **M15 — Payments, Receipts & Settlement Foundation**.
