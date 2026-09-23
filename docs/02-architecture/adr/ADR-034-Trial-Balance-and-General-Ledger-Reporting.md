# ADR-034: Trial Balance and General Ledger Reporting

## Status

Accepted

## Context

Tenants need authoritative reporting on general ledger account balances and chronological transaction histories without data duplication or stale caches.

## Decision

1. The posted journal entries (`JournalEntry` with `status: POSTED` and associated `JournalLine` records) serve as the single source of truth.
2. Trial Balance aggregates opening debit/credit, period debit/credit, and closing debit/credit per account.
3. General Ledger dynamically computes chronological running balances respecting the debit/credit nature of each account type (Asset/Expense: $+D -C$; Liability/Equity/Revenue: $+C -D$).
4. Total Debits must strictly equal Total Credits on the Trial Balance.

## Consequences

- Single source of truth eliminates data discrepancies between reports and postings.
- Exact `Decimal` arithmetic ensures total accuracy across all currencies.
