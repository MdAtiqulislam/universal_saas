# ADR-030: Payment Reversal and Idempotency

## Status

Accepted

## Context

When financial transactions such as customer receipts or supplier payments need to be cancelled (e.g. bounced checks, incorrect accounts, payment processing errors), accounting standards prohibit deleting or mutating posted journal entries. Furthermore, concurrent posting or allocation requests must be protected against race conditions and double allocations.

## Decision

1. **Compensating General Ledger Reversal**:
   - Posted payments and posted journal entries are strictly immutable.
   - When a payment is voided (`void`), the system:
     - Reverses invoice settlement effects by subtracting allocated amounts from `amountPaid` and restoring `amountDue` on open/paid invoices.
     - Deletes associated `PaymentAllocation` records.
     - Creates a balanced M12 compensating reversal journal entry with inverted debits and credits (`sourceType: 'REVERSAL'`).
     - Marks the original journal entry `VOIDED`.
     - Marks the payment record `status = VOIDED` and sets `voidedAt = now()`.
2. **Idempotency & Concurrency Guards**:
   - Posting is idempotent: attempting to post a non-`DRAFT` payment fails with an explicit state error (`BadRequestException`).
   - Allocations execute inside database transactions with row-level locks, ensuring `SUM(allocations) <= unallocatedAmount` and `allocation <= amountDue`.
   - Concurrency tests verify that 100 simultaneous post operations yield exactly 1 success, and simultaneous allocation attempts prevent negative due balances.

## Consequences

- **Positive**: Strict GAAP compliance and immutable audit trail.
- **Positive**: Zero risk of financial ledger corruption or double posting during network retries or concurrent user activity.
- **Negative**: Reversal requires an open fiscal period covering the transaction reversal date.
