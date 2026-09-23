# ADR-037: Credit Note and Debit Note Lifecycle Strategy

## Status

Accepted

## Context

In business operations, commercial adjustments arise from returned goods, pricing discrepancies, damaged deliveries, and rebates. The platform requires a formal lifecycle model for Customer Credit Notes and Supplier Debit Notes that integrates with multi-tenant Accounts Receivable, Accounts Payable, and the General Ledger.

## Decision

1. **Explicit State Machine**: Both Credit Notes and Debit Notes adopt explicit statuses: `DRAFT`, `APPROVED`, `POSTED`, `PARTIALLY_APPLIED`, `APPLIED`, and `VOIDED`.
2. **Double-Entry General Ledger Posting**:
   - Posting occurs when moving from `APPROVED` (or `DRAFT`) to `POSTED`.
   - Credit Notes debit `SALES_RETURNS` (or `SALES_REVENUE`) and `OUTPUT_TAX`, and credit `ACCOUNTS_RECEIVABLE`.
   - Debit Notes debit `ACCOUNTS_PAYABLE`, and credit `PURCHASE_EXPENSE` (or `INVENTORY_ASSET`) and `INPUT_TAX`.
3. **Application & Settlement**:
   - Application against invoices occurs post-issuance without additional GL journal creation because AR/AP subledger balances were established at posting time.
   - Applications atomically adjust invoice `amountDue`, `amountPaid`, and status (`PARTIALLY_PAID` / `PAID`).
4. **Voiding & Reversal**:
   - Posted adjustments with zero active applications can be voided by creating an immutable compensating reversal `JournalEntry`.

## Consequences

- **Positive**: Strict financial auditability, tamper-proof state transitions, zero balance discrepancies between AR/AP subledgers and the General Ledger.
- **Negative**: Applications must be unapplied/reversed before voiding a posted credit note.
