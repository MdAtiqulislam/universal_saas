# ADR-027: Customer Invoicing General Ledger Posting and Compensating Reversals

## Status

Accepted

## Context

Customer invoices must post directly into the multi-tenant general ledger without manual journal entry drafting, maintaining strict double-entry balance and audit trail integrity.

## Decision

### 1. Dynamic AR Account Mapping

Reuses `AccountingAccountMapping` with AR-specific keys:

- `ACCOUNTS_RECEIVABLE` (Asset)
- `SALES_REVENUE` (Revenue)
- `OUTPUT_TAX` (Liability)
- `SALES_DISCOUNT` (Revenue reduction)

### 2. Double-Entry Posting Pipeline

Issuing an invoice atomically generates an M12 `JournalEntry` with `sourceType: 'CUSTOMER_INVOICE'`:

- **Debit**: Accounts Receivable (`grand_total`)
- **Credit**: Sales Revenue (`subtotal - discount_amount`)
- **Credit**: Output Tax (`tax_amount`, if $> 0$)

Parity Invariant: $\sum \text{Debit} == \sum \text{Credit} == \text{grand\_total}$.

### 3. Compensating Reversals

Voiding an issued invoice generates a new compensating journal entry with flipped debits and credits referencing `sourceType: 'REVERSAL'`. The original journal and invoice records are marked `VOIDED`.

## Consequences

- **Positive**: Strict GAAP/IFRS adherence with automatic journal postings and immutable audit trails.
- **Negative**: Invoices cannot be issued if mapped accounts are missing or the fiscal period is closed.
