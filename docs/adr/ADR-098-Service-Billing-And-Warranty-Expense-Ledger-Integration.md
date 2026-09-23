# ADR-098: Service Billing and Warranty Expense Ledger Integration

## Status

Accepted

## Context

Servicing customer equipment produces two financial streams: (1) billable customer charges for out-of-warranty labor and components, and (2) warranty expenses absorbed by the enterprise. Financial postings must strictly reuse M14 Accounts Receivable and M12 General Ledger, respecting the M33 fiscal period locking engine.

## Decision

1. Billable service orders generate M14 `CustomerInvoice` records in `ISSUED` status, with full line item breakdown for parts and labor, linked via `customerInvoiceId`. Duplicate invoice creation is prohibited by invariant 250.
2. Warranty repairs trigger balanced GL journal entries (debit Warranty Expense, credit Service Inventory/Applied Labor) posted via `AccountingPostingService`.
3. Financial postings reject execution if the active fiscal period is `CLOSED` or `CLOSING` (M33 closed period protection).

## Consequences

### Positive

- Authoritative financial records without secondary accounting engines.
- Precise separation of service revenue and warranty warranty claims expense.
- Full compliance with fiscal period close boundaries.

### Negative

- Closed fiscal periods require authorized reopening before historical warranty entries can be adjusted.
