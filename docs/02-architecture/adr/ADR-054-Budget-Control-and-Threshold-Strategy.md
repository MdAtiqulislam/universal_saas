# ADR-054: Budget Control and Threshold Strategy

## Status

Accepted

## Context

Organizations need the ability to proactively verify whether a proposed expenditure (e.g. Purchase Order, Supplier Invoice, Expense Claim) exceeds available budget before financial commitment. At the same time, existing accounting workflows must not be inadvertently broken by rigid enforcement.

## Decision

1. **Reusable Verification Service**:
   - Provide `BudgetControlService.checkBudgetAvailability(...)` accepting `organizationId`, `accountId`, `amount`, and `date`.
2. **Configurable Control Policies**:
   - `CHECK_ONLY`: Analyzes utilization metrics without enforcement.
   - `WARN`: Emits threshold/exceeded domain events and alerts users, but permits transaction execution.
   - `BLOCK`: Returns `EXCEEDED` status to reject unauthorized over-budget transactions.
3. **Threshold Alerts**:
   - Standard warning thresholds (e.g., $75\%$, $90\%$, $100\%$) emit domain events (`BUDGET_THRESHOLD_REACHED`, `BUDGET_EXCEEDED`, `BUDGET_VARIANCE_DETECTED`) to notify finance administrators.

## Consequences

- Downstream modules can opt into budget availability checks dynamically.
- Existing standard accounting postings remain backward-compatible without disruption.
