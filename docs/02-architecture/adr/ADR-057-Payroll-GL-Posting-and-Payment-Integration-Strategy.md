# ADR-057: Payroll GL Posting & Payment Integration Strategy

## Status

Accepted

## Context

Approved payroll runs must integrate with the platform General Ledger (M12) and Payment Infrastructure (M15) without bypassing financial integrity checks, double-entry balance, or duplicate disbursement controls.

## Decision

1. **General Ledger Integration (M12)**:
   - Construct balanced double-entry General Ledger postings:
     - `Debit`: Payroll Expense (`grossPay`), Employer Contribution Expense (`employerContributions`)
     - `Credit`: Salaries Payable (`netPay`), Tax Withholding Payable (`totalTax`), Deductions & Pension Payable (`totalDeductions` + `employerContributions`)
   - Strictly enforce:
     $$\text{Total Debits} = \text{Total Credits} = \text{Gross Pay} + \text{Employer Contributions}$$
   - Associate journal entries with `sourceType = 'PAYROLL'` and `sourceId = payrollRunId`.
2. **Disbursement Integration (M15)**:
   - Generate authoritative `Payment` records against designated cash or bank `PaymentAccount`.
   - Prevent duplicate disbursements by checking existing `payrollRun.paymentId`.
   - Atomically transition `PayrollEmployee.paymentStatus` to `PAID`.
3. **Budget Control Integration (M23)**:
   - Provide pre-posting budget availability verification (`CHECK_ONLY`, `WARN`, `BLOCK`) against expense accounts before GL finalization.

## Consequences

- Guarantees absolute reconciliation between Payroll sub-ledger, General Ledger, and Payment Accounts.
- Ensures zero financial leakage or unaccounted employer liabilities.
