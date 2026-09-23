# ADR-028: Payment and Settlement Architecture

## Status

Accepted

## Context

The Universal Business Operations SaaS platform requires a unified, tenant-aware payment management foundation capable of handling both customer receipts (Order-to-Cash) and supplier payments (Procure-to-Pay). The system must bridge operational transactions with double-entry accounting in M12 General Ledger, maintain strict tenant isolation, and ensure money amounts are tracked with exact decimal precision without rounding errors.

## Decision

1. **Unified Payment Entity**: Implement a unified `Payment` model parameterized by `PaymentType` (`RECEIPT` vs. `PAYMENT`), sharing common transaction tracking, numbering, currency, and lifecycle states while maintaining strict validation based on transaction direction.
2. **Payment Account Abstraction**: Decouple operational funds handling (cash drawers, bank checking accounts, mobile money wallets) from hardcoded GL accounts by introducing `PaymentAccount`. Each payment account references a tenant GL `Account` (`accountingAccountId`).
3. **Database Constraints & Precision**:
   - `DECIMAL(20, 4)` precision on all monetary quantities (`amount`, `allocatedAmount`, `unallocatedAmount`).
   - Check constraints: `chk_payment_amounts` (`amount > 0`, `allocated_amount >= 0`, `unallocated_amount >= 0`, `allocated_amount <= amount`), `chk_payment_balance` (`unallocated_amount = amount - allocated_amount`).
   - Strict XOR foreign key check on `PaymentAllocation` ensuring an allocation targets either a `CustomerInvoice` OR a `SupplierInvoice`, but never both.
4. **Numbering & Audit**:
   - Customer receipts generate `RC-` prefixed sequential identifiers.
   - Supplier payments generate `PY-` prefixed sequential identifiers.
   - All state transitions emit domain audit events via M06 EventBus.

## Consequences

- **Positive**: Clean abstraction supporting cash, bank, and mobile wallets across AR and AP workflows without duplicating payment logic.
- **Positive**: Exact balance tracking and database-enforced invariants prevent money over-allocation or negative balances.
- **Negative**: Multi-currency exchange rate conversions and bank reconciliations are deferred to subsequent financial milestones.
