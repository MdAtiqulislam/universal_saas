# ADR-033: Cash Adjustment and Reconciliation Posting

## Status

Accepted

## Context

Bank statements often include fees, interest credits, or unexpected adjustments not previously recorded in the accounting general ledger. These transactions cannot be left unreconciled or manually edited into external ledger tables directly.

## Decision

1. Provide an adjustment mechanism that generates balanced M12 General Ledger journal entries directly through the accounting posting service.
2. For Bank Charges (Debits on statement):
   - Debit: Selected Expense Account (e.g. Bank Charges)
   - Credit: Payment Account General Ledger Asset Account
3. For Bank Interest (Credits on statement):
   - Debit: Payment Account General Ledger Asset Account
   - Credit: Selected Income Account (e.g. Interest Income)
4. Link the generated `JournalEntry` back to `BankStatementTransaction.matchedJournalEntryId` with status `ADJUSTED`.
5. Require active Open fiscal period covering the statement transaction date.

## Consequences

- Preserves 100% GL auditability and fiscal period controls.
- Eliminates manual adjustments outside double-entry bookkeeping rules.
