# Milestone M24 — Payroll, Employee & HR Management Foundation

## Overview

Milestone M24 establishes a multi-tenant, financially integrated Employee and Payroll management system for the Universal Business Operations SaaS platform. The module orchestrates organizational hierarchies (Departments & Job Positions), employee master records, effective-dated compensation structures, deterministic payroll calculations with tax and pension abstractions, immutable execution snapshots, double-entry General Ledger postings (M12), automated salary payment disbursements (M15), pre-posting budget validations (M23), and sensitive data protection.

---

## Key Domain Components

### 1. Organizational Hierarchy & Employee Master

- **Department**: Multi-tenant hierarchical trees with cycle/loop detection and self-parenting prevention.
- **JobPosition**: Scoped position definitions and titles linked to departments.
- **Employee**: Core employee lifecycle tracking (`ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `TERMINATED`, `FULL_TIME`, `PART_TIME`, `CONTRACT`, `TEMPORARY`, `INTERN`).
- **EmployeeCompensation**: Effective dating (`effectiveFrom` to optional `effectiveUntil`) with non-overlapping constraints, preserving full compensation history and exact `DECIMAL(20, 4)` precision.

### 2. Payroll Configuration & Components

- **PayrollConfiguration**: Tenant-level frequency (`MONTHLY`, `BI_MONTHLY`, `WEEKLY`), standard working hours, overtime/tax switches, and General Ledger account mappings.
- **PayrollComponent**: Customizable earnings, deductions, allowances, and taxes mapped to GL expense and liability accounts.
- **PayrollInput**: Periodized variable inputs (overtime hours/amounts, bonuses, commissions, unpaid leave deductions).

### 3. Calculation & Workflow Engine

- **PayrollPeriod**: Schedule aggregates (`PR-000001`) with discrete status lifecycle:
  $$\text{DRAFT} \to \text{CALCULATING} \to \text{CALCULATED} \to \text{APPROVED} \to \text{POSTED} \to \text{PAID} \to \text{CLOSED}$$
- **PayrollRun**: Execution snapshot header (`PRUN-000001`) with totals and itemized `PayrollEmployee` records.
- **Formulas**:
  - $\text{Gross Pay} = \text{Base Salary} + \text{Allowances} + \text{Overtime} + \text{Bonuses} + \text{Commissions} - \text{Unpaid Leave}$
  - $\text{Taxable Income} = \text{Gross Pay}$
  - $\text{Employee Tax} = \text{TaxStrategy.calculate(Taxable Income)}$
  - $\text{Employee Deductions} = \text{Employee Pension (5\%)} + \text{Custom Deductions}$
  - $\text{Employer Contributions} = \text{Employer Pension (10\%)}$
  - $\text{Net Pay} = \text{Gross Pay} - \text{Employee Tax} - \text{Employee Deductions}$
  - $\text{Total Employer Cost} = \text{Gross Pay} + \text{Employer Contributions}$

### 4. General Ledger & Payment Integration

- **General Ledger Posting (M12)**:
  - `Debit`: Payroll Expense (`grossPay`), Employer Contribution Expense (`employerContributions`)
  - `Credit`: Salaries Payable (`netPay`), Tax Withholding Payable (`totalTax`), Deductions & Pension Payable (`totalDeductions` + `employerContributions`)
  - Enforces balanced double-entry ($\text{Total Debits} = \text{Total Credits}$).
- **Disbursement (M15)**:
  - Generates authoritative `Payment` record linked to cash/bank `PaymentAccount`.
  - Updates `PayrollEmployee` payment statuses to `PAID` with duplicate payment rejection.
- **Budget Control (M23)**:
  - Pre-posting availability verification against organizational budget limits.

### 5. Security & Sensitive Reporting

- Dedicated RBAC permission `payroll.reports.sensitive` protects compensation and historical employee earnings.
- Automatic audit log redaction (`[REDACTED]`) on compensation and national ID fields.
- 18 domain audit events published over `EventBusService`.
