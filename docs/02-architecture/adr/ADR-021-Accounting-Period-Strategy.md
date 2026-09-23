# ADR-021: Fiscal Period Lifecycle and Posting Lock Strategy

## Status

Accepted

## Context

General ledger accounting requires dividing time into discrete fiscal periods (e.g. monthly, quarterly, annual). Once a financial reporting period is closed, no new journal entries may be added to ensure the integrity of published financial statements.

## Decision

### 1. Period Definition & Overlap Prevention

- Each tenant maintains independent `FiscalPeriod` records with `startDate` and `endDate`.
- Date invariant: `startDate < endDate` (`chk_fiscal_period_dates`).
- Overlap prevention: New fiscal periods cannot overlap date ranges with existing periods within the same organization.

### 2. Period Status & Locking

- Statuses: `OPEN` $\to$ `CLOSED`.
- Period closure (`close()`) is irreversible in the standard operational flow.
- The `AccountingPostingService` strictly requires `fiscalPeriod.status === FiscalPeriodStatus.OPEN` and that the journal `entryDate` lies within `[startDate, endDate]`. Any posting attempt into a `CLOSED` period is immediately rejected.

## Consequences

- **Positive**: Guaranteed stability of historical accounting statements; prevents retroactive adjustments.
- **Negative**: Corrections after period close require posting into the current open period.
