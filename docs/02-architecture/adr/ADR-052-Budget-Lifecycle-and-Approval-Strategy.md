# ADR-052: Budget Lifecycle and Approval Strategy

## Status

Accepted

## Context

Corporate budgeting involves multiple stakeholders drafting, reviewing, approving, and activating spending plans for upcoming fiscal years. We need a lifecycle model that ensures strict governance, prevents modifications to approved or active budgets, and handles versioning.

## Decision

1. **Explicit Lifecycle States**:
   - `DRAFT`: Fully editable. Lines can be inserted, updated, and removed.
   - `SUBMITTED`: Under management review; editing locked.
   - `APPROVED`: Formally authorized by organization management.
   - `ACTIVE`: The authoritative operational budget used for spending controls.
   - `CLOSED`: Concluded fiscal period; immutable.
   - `CANCELLED` / `REJECTED`: Aborted or rejected budget drafts.
2. **Single Active Budget per Fiscal Year**:
   - Activating a budget automatically closes or supersedes any previously active budget for the same fiscal year.
3. **Immutability of Operational Budgets**:
   - Budgets in `APPROVED`, `ACTIVE`, or `CLOSED` status cannot be directly edited.

## Consequences

- Guarantees financial governance and prevents inadvertent changes to active operational spending plans.
