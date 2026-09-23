# ADR-091: Accounting Period and Close Control Strategy

## Status

Accepted

## Context

Closing an accounting period is a mission-critical financial operation. Allowing users to close a fiscal period without validating underlying subledgers, trial balance balance equality, or draft unposted transactions causes financial misstatements and reporting errors.

## Decision

1. **Three-Phase Period Lifecycle**:
   - `OPEN`: Standard operational state accepting balanced postings within the period date window.
   - `CLOSING`: Transitional lock state initiated by finance teams during close review.
   - `CLOSED`: Permanent immutability lock state prohibiting all financial postings.
2. **Deterministic 11-Check Validation Engine (`PeriodCloseEngineService`)**:
   - Check 1: Trial Balance debit/credit equality.
   - Check 2: Unbalanced or incomplete draft journals.
   - Check 3: Unposted operational transactions (draft journals, unposted supplier invoices, unposted payments).
   - Check 4: AP subledger vs GL Accounts Payable reconciliation.
   - Check 5: AR subledger vs GL Accounts Receivable reconciliation.
   - Check 6: Inventory valuation cost layers vs GL inventory assets.
   - Check 7: Tax transactions vs GL tax liability/asset accounts.
   - Check 8: Payroll runs posted vs unposted draft/calculating runs.
   - Check 9: Fixed asset depreciation entries recorded for the period.
   - Check 10: Cost of Goods Sold (COGS) records vs GL COGS expense accounts.
   - Check 11: Subledger reconciliation aggregate check.
3. **Execution Diagnostics**: Every pre-close evaluation persists a `PeriodCloseRun` and detailed `PeriodCloseCheck` records for audit traceability.

## Consequences

### Positive

- Fully automated, deterministic audit readiness verification.
- Prohibits premature period close when blocking failures are present.
- Provides complete visibility into the root causes of period close blockers.
