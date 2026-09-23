# ADR-029: Payment Posting and Allocation Strategy

## Status

Accepted

## Context

In enterprise business operations, the receipt/disbursement of funds and the settlement of specific invoices often occur asynchronously. A customer may make an advance deposit before an invoice is issued, or make a lump-sum payment covering multiple invoices. Coupling General Ledger posting to invoice allocation creates duplicate, noisy journal entries whenever allocations change.

## Decision

1. **Decouple Posting from Allocation**:
   - **Posting Phase (`post`)**: Creates the primary financial journal entry recording the cash/bank movement.
     - **Customer Receipt**: Debit Payment Account (Asset), Credit Accounts Receivable (Asset).
     - **Supplier Payment**: Debit Accounts Payable (Liability), Credit Payment Account (Asset).
     - The general ledger is updated once at payment posting time.
   - **Allocation Phase (`allocate`)**: Applies the unallocated balance of a posted payment against open customer or supplier invoices.
     - Updates invoice `amountPaid` and `amountDue`.
     - Updates payment `allocatedAmount` and `unallocatedAmount`.
     - Allocations do not generate new General Ledger journal rows because AR/AP control totals were already adjusted upon posting.
2. **Advance / Unallocated Payment Support**:
   - Payments with `unallocatedAmount > 0` are tracked natively as advances without creating placeholder invoices.
   - Query endpoints `GET /api/v1/receivables/unallocated` and `GET /api/v1/payables/unallocated` surface unapplied liquidity immediately.

## Consequences

- **Positive**: Clean General Ledger audit trail without spurious entries for routine re-allocations or split-settlements.
- **Positive**: Native support for customer advances, partial payments, and multi-invoice lump-sum settlements.
- **Negative**: Currency matching is strictly enforced (payment currency must match invoice currency); cross-currency allocation is rejected until multi-currency FX gains/losses are implemented.
