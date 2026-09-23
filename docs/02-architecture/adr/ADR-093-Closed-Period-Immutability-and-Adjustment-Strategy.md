# ADR-093: Closed Period Immutability and Adjustment Strategy

## Status

Accepted

## Context

When an accounting period is closed, its financial state is finalized for reporting, tax filings, and investor reporting. Any subsequent mutation inside a closed period invalidates prior financial statements and violates GAAP/IFRS accounting standards.

## Decision

1. **Narrowest Shared Authoritative Enforcement**:
   - Closed period enforcement is baked into `AccountingPostingService.post()`—the singular gateway through which all journal entries are posted across all modules.
   - If a journal entry targets a fiscal period with status `CLOSED` or `CLOSING`, the posting transaction is rejected immediately with a `BadRequestException`.
2. **Authorized Period Reopening Workflow**:
   - Reopening a `CLOSED` fiscal period requires dedicated permission (`accounting.periods.reopen`).
   - A mandatory justification reason ($\ge 5$ characters) must be supplied.
   - The reopen event records `reopenedAt`, `reopenedByUserId`, and `reopenReason`, publishing a domain audit event `ACCOUNTING_PERIOD_REOPENED`.
3. **Audited Adjustment Journals**:
   - When adjustments are made to a reopened period, journal entries must specify `sourceType = 'PERIOD_ADJUSTMENT'` to maintain explicit linkage to the audit close cycle.

## Consequences

### Positive

- Strict period immutability preventing retroactive alterations to published financials.
- Complete regulatory and internal audit trail for historical adjustments.
