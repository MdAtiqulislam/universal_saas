# ADR-047: Employee Reimbursement and Payment Integration Strategy

## Status

Accepted

## Context

Employee expense reimbursements represent outbound monetary disbursements similar to supplier payments, but directed towards employees/claimants rather than commercial vendors. We need to support partial and full reimbursements while reusing the existing M15 Payment infrastructure without duplication or regression.

## Decision

1. **Extend M15 Payment Model**:
   - Add `REIMBURSEMENT` to `PaymentType` enum.
   - Add nullable `claimantId` foreign key to `Payment`.
   - Add nullable `expenseClaimId` foreign key to `PaymentAllocation`.
2. **Transaction-Safe Balance Reduction**:
   - Each reimbursement payment is executed within a database transaction that verifies the claim's current `dueAmount >= paymentAmount`.
   - The transaction increments `paidAmount` and decrements `dueAmount`.
   - When `dueAmount` reaches zero, status transitions to `PAID`.
3. **Double-Entry Journal Posting**:
   - **Debit**: Employee Expense Payable Account (`EMPLOYEE_EXPENSE_PAYABLE`).
   - **Credit**: Cash / Bank Asset Account (`paymentAccount.accountingAccountId`).
4. **Concurrency Safety**:
   - Enforce row-level consistency during payment execution to prevent concurrent overpayments.

## Consequences

- Single unified payment ledger across customer receipts, supplier payments, and employee reimbursements.
- Zero code duplication for bank statement reconciliation and cash account management.
