# ADR-046: Expense Claim Lifecycle and Approval Strategy

## Status

Accepted

## Context

Expense claims involve multi-party interactions between claimants (employees/contractors), managers/approvers, and finance teams. We need a deterministic, auditable, transaction-safe lifecycle that prevents mutation once financial commitments are approved or posted to the General Ledger.

## Decision

1. **Explicit State Machine**:
   - `DRAFT`: Editable by creator/claimant.
   - `SUBMITTED`: Locked for edits; pending managerial review.
   - `APPROVED`: Authorized by manager; sets `approvedAmount` and `dueAmount`.
   - `REJECTED`: Terminal state with mandatory rejection reason.
   - `CANCELLED`: Terminal state prior to financial posting.
   - `POSTED`: Immutable financial record linked to a double-entry Journal Entry in an OPEN fiscal period.
   - `PAID`: Fully settled via reimbursement payments (`dueAmount == 0`).
   - `CLOSED`: Administrative finality.
   - `VOIDED`: Reversal state; creates a balanced compensating reversal Journal Entry.
2. **Immutability & Audit**:
   - Posted claims cannot have their lines or financial amounts edited.
   - Any cancellation after posting requires a formal `void()` action which validates `paidAmount == 0` and posts compensating reversal entries.
3. **Event Publication**:
   - All state transitions emit domain events (`EXPENSE_CLAIM_CREATED`, `EXPENSE_CLAIM_SUBMITTED`, `EXPENSE_CLAIM_APPROVED`, `EXPENSE_CLAIM_POSTED`, `EXPENSE_CLAIM_VOIDED`).

## Consequences

- Clean separation of operational drafting from financial ledger commitment.
- Strong non-repudiation and regulatory compliance.
