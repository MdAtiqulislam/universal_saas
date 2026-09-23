# M15 — Payments, Receipts & Settlement Foundation

## 1. Overview

Milestone **M15 — Payments, Receipts & Settlement Foundation** establishes the multi-tenant payment collection and disbursement engine for the Universal Business Operations SaaS platform. It integrates Customer Invoices (M14 AR), Supplier Invoices (M13 AP), Chart of Accounts & General Ledger (M12 Accounting), Customers (M11), and Suppliers (M10).

---

## 2. Architectural Concepts

### 2.1 Payment Account Abstraction (`PaymentAccount`)

Payment accounts represent physical or digital funds containers:

- **Types**: `CASH` (cash drawers), `BANK` (checking/savings accounts), `MOBILE_WALLET` (digital wallets), `OTHER`.
- **GL Mapping**: Every payment account directly maps to an active tenant `Account` in the General Ledger (`accountingAccountId`).
- **Tenant Scope**: Completely isolated per tenant with unique codes (e.g., `CASH-MAIN`, `BANK-CORP`).

### 2.2 Payment Model (`Payment`)

Supports both receivables and payables:

- **`RECEIPT`**: Customer receipt of funds against customer accounts/invoices (`RC-000001` auto-numbering).
- **`PAYMENT`**: Supplier payment disbursement against supplier accounts/invoices (`PY-000001` auto-numbering).
- **Precision**: Exact `DECIMAL(20, 4)` for `amount`, `allocatedAmount`, and `unallocatedAmount`.
- **Invariants**:
  $$\text{amount} > 0$$
  $$\text{allocatedAmount} \ge 0, \quad \text{unallocatedAmount} \ge 0$$
  $$\text{allocatedAmount} \le \text{amount}$$
  $$\text{unallocatedAmount} = \text{amount} - \text{allocatedAmount}$$

### 2.3 Separation of Posting vs. Allocation

- **Posting (`DRAFT` $\to$ `POSTED`)**:
  - Atomically records the movement of money in/out of the payment account and general ledger.
  - Customer Receipt:
    $$\text{Debit: Payment Account (Bank/Cash)} \quad \text{Credit: Accounts Receivable}$$
  - Supplier Payment:
    $$\text{Debit: Accounts Payable} \quad \text{Credit: Payment Account (Bank/Cash)}$$
  - Generates balanced, immutable M12 `JournalEntry`.
- **Allocation (`POSTED` $\to$ `PARTIALLY_ALLOCATED` $\to$ `ALLOCATED`)**:
  - Applies unallocated payment balances against one or more open invoices.
  - Updates invoice `amountPaid` and `amountDue`.
  - Transitions invoice status (`PARTIALLY_PAID` or `PAID`).
  - Advances/Unallocated payments are supported without creating fake invoices or extra journal entries.

### 2.4 Payment Allocations (`PaymentAllocation`)

- Database-level XOR constraint: Each allocation record must reference either a `CustomerInvoice` OR a `SupplierInvoice`, but never both.
- Amount must be positive ($\text{amount} > 0$).
- Single payments can be split across multiple invoices.

### 2.5 Reversal & Voiding (`VOIDED`)

- Non-destructive reversal:
  - If invoices were settled, allocations are deleted and invoice `amountPaid`/`amountDue` balances are restored.
  - If a GL journal was posted, a compensating reversal journal entry is generated with inverted debit/credit lines.
  - Payment is stamped with `status = VOIDED` and `voidedAt`.

---

## 3. REST API Endpoints

### Payment Accounts (`/api/v1/payment-accounts`)

- `GET /api/v1/payment-accounts` — List tenant payment accounts
- `POST /api/v1/payment-accounts` — Create payment account mapped to GL account
- `GET /api/v1/payment-accounts/:id` — Get payment account details
- `PATCH /api/v1/payment-accounts/:id` — Update payment account
- `DELETE /api/v1/payment-accounts/:id` — Deactivate / remove payment account

### Payments & Settlements (`/api/v1/payments`, `/api/v1/receipts`, `/api/v1/supplier-payments`)

- `GET /api/v1/payments` — Query payments with filters (type, status, customer, supplier, date range)
- `POST /api/v1/payments` — Create draft payment (type `RECEIPT` or `PAYMENT`)
- `POST /api/v1/receipts` — Convenience endpoint for customer receipts
- `POST /api/v1/supplier-payments` — Convenience endpoint for supplier payments
- `GET /api/v1/payments/:id` — Get payment details and allocations
- `POST /api/v1/payments/:id/post` — Post payment to General Ledger
- `POST /api/v1/payments/:id/allocate` — Atomically allocate payment across open invoices
- `POST /api/v1/payments/:id/void` — Void payment with compensating reversal
- `GET /api/v1/receivables/unallocated` — List unapplied customer receipt balances
- `GET /api/v1/payables/unallocated` — List unapplied supplier payment balances
