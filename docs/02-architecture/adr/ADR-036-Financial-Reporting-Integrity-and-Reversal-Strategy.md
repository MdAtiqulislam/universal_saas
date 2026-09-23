# ADR-036: Financial Reporting Integrity and Reversal Strategy

## Status

Accepted

## Context

When transactions are voided, M12 creates compensating reversal journal entries rather than deleting historical records. Financial reporting queries must process these reversals accurately without corrupting debit/credit integrity or hiding audit trails.

## Decision

1. Financial reports include all entries where `status == POSTED`, naturally including compensating reversal entries (`sourceType: 'REVERSAL'`).
2. Because reversal entries feature inverted debits and credits, their net impact on financial statements cleanly offsets the original posted entries.
3. Closed fiscal periods remain fully queryable for reporting purposes but remain locked against modifications.
4. If an unresolvable accounting imbalance is detected, reporting operations fail with explicit accounting errors rather than presenting incorrect numbers.

## Consequences

- Preserves 100% auditability and GAAP/IFRS alignment.
- Guarantees historical consistency across closed and open periods.
