# ADR-090: Financial Reporting Source-of-Truth Strategy

## Status

Accepted

## Context

A major design challenge in ERP and business SaaS platforms is avoiding discrepancies between transactional operational modules and financial reporting statements (Trial Balance, General Ledger, Profit & Loss, Balance Sheet, Cash Flow). If reports query operational entities directly or maintain detached redundant ledger engines, discrepancies, timing mismatches, and audit failures inevitably occur.

## Decision

1. **Single Authoritative Source**: The General Ledger (`JournalEntry` and `JournalLine` records with `status = POSTED`) is the sole authoritative foundation for all financial statements.
2. **No Second Accounting Engine**: All operational engines (M13 AP, M14 AR, M15 Payments, M18 Credits/Debits/Refunds, M19 COGS/Valuation, M20 Tax, M21 Expenses, M22 Fixed Assets, M24 Payroll, M25 Manufacturing, M27 Procurement, M28 Sales Orders, M32 Returns) post balanced journal entries into the GL via `AccountingPostingService`.
3. **Derived Real-Time Statements**: Trial Balance, General Ledger Explorer, Income Statement (P&L), Balance Sheet, and Cash Flow calculate aggregations directly from posted journal lines matching active chart-of-accounts classifications.
4. **Immutable Snapshots**: Official historical reports can be captured as immutable snapshots (`FinancialReportSnapshot`) with cryptographic SHA-256 checksums to preserve point-in-time state for external audits and regulatory filings.

## Consequences

### Positive

- Strict mathematical integrity: Trial Balance debits always equal credits ($TotalDebits = TotalCredits$).
- Zero discrepancies between balance sheet retained earnings and cumulative income statement net income.
- Strict multi-tenant isolation enforced on every query.
- Cryptographic proof of report immutability.

### Negative

- Heavy analytical reporting requires indexed database queries on `(organization_id, fiscal_period_id, status, entry_date)`.
