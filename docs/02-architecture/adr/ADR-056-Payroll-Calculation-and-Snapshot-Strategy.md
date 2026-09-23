# ADR-056: Payroll Calculation & Snapshot Strategy

## Status

Accepted

## Context

Payroll processing involves complex combinations of base salary, recurring allowances, variable inputs (overtime, commissions, bonuses, unpaid leave), statutory progressive taxes, and pension deductions. Recomputing payroll dynamically on historical periods introduces financial non-determinism if compensation records or tax rules change later.

## Decision

1. **Deterministic Calculation Pipeline**:
   - Aggregate compensation components and period inputs per employee.
   - Compute:
     $$\text{Gross Pay} = \text{Base Salary} + \text{Allowances} + \text{Overtime} + \text{Bonuses} + \text{Commissions} - \text{Unpaid Leave}$$
     $$\text{Taxable Income} = \text{Gross Pay}$$
     $$\text{Employee Tax} = \text{TaxStrategy.calculate(Taxable Income)}$$
     $$\text{Employee Deductions} = \text{Pension (5\%)} + \text{Other Deductions}$$
     $$\text{Net Pay} = \text{Gross Pay} - \text{Employee Tax} - \text{Employee Deductions}$$
     $$\text{Employer Cost} = \text{Gross Pay} + \text{Employer Pension (10\%)}$$
2. **Immutable Snapshot Persistence**:
   - Store all calculated outputs atomically in `PayrollRun` and `PayrollEmployee` records.
   - Changes to future compensation or tax rates do not alter historical calculation snapshots.
3. **Approval Lifecycle**:
   - Calculation transitions period to `CALCULATED`.
   - Requires explicit approval transition (`CALCULATED` $\to$ `APPROVED`) prior to general ledger posting.

## Consequences

- Guarantees financial immutability and reproducibility across payroll runs.
- Simplifies payroll reporting and historical employee income audits.
