# ADR-053: Budget vs Actual Calculation Strategy

## Status

Accepted

## Context

Accurate financial reporting requires comparing planned budget figures against real operational results. Sourcing actuals from draft invoices or disparate sub-ledgers risks double counting or reporting unposted transactions.

## Decision

1. **Authoritative General Ledger Sourcing**:
   - Actuals are computed strictly by aggregating posted `JournalLine` entries (`journalEntry.status == POSTED`).
   - Draft and unposted journals are completely excluded from actual balance calculations.
2. **Account Classification Orientation**:
   - For `EXPENSE` and `ASSET` accounts: $\text{Actual} = \sum(\text{Debit}) - \sum(\text{Credit})$.
   - For `REVENUE`, `LIABILITY`, and `EQUITY` accounts: $\text{Actual} = \sum(\text{Credit}) - \sum(\text{Debit})$.
3. **Variance Formula**:
   - $\text{Variance} = \text{Budget} - \text{Actual}$.
   - Positive variance on expenses indicates under-budget spending (favorable).
   - Negative variance indicates over-budget spending (unfavorable).
4. **Drill-Down Capability**:
   - Provide direct linkage from actual balances down to individual posted General Ledger journal entries.

## Consequences

- Single source of truth for all financial comparisons.
- Zero discrepancy between Budget vs Actual reports and the General Ledger Trial Balance.
