# ADR-038: Customer Refund and Settlement Integration Strategy

## Status

Accepted

## Context

When a customer has excess credit from a Credit Note (or overpayment) and requests a payout rather than applying the credit towards future invoices, a direct cash outflow must occur. The system must record customer refunds cleanly against payment accounts and the General Ledger.

## Decision

1. **Dedicated CustomerRefund Model**:
   - `CustomerRefund` references `Customer`, optional `CustomerCreditNote`, `PaymentAccount` (Bank/Cash), and `Currency`.
2. **Posting Mechanics**:
   - Debit: `ACCOUNTS_RECEIVABLE` (reduces customer credit / accounts receivable credit balance).
   - Credit: `PaymentAccount.accountingAccountId` (records cash outflow from the designated bank account).
3. **Credit Note Balance Synchronization**:
   - If linked to a `CustomerCreditNote`, posting a refund atomically increments `creditNote.appliedAmount` and decrements `creditNote.remainingAmount`.
   - Transitions credit note status to `PARTIALLY_APPLIED` or `APPLIED`.
4. **Reversal Protocol**:
   - Voiding a posted refund generates a reversal GL journal (Debit Bank, Credit AR) and restores the available balance on the linked credit note.

## Consequences

- **Positive**: Direct integration with M15 Payment Accounts and M16 Bank Reconciliation.
- **Negative**: Bank account balance must be checked to prevent unauthorized over-draft payouts.
