# ADR-055: Employee & Payroll Domain Model Strategy

## Status

Accepted

## Context

Universal Business Operations SaaS requires an authoritative, multi-tenant human resources and payroll foundation (Milestone M24). Managing employee lifecycles, salary progressions, allowances, overtime, and organizational hierarchies requires strict isolation, non-overlapping effective dates, and seamless integration with existing tenant RBAC (M05), Audit (M06), and Numbering (M07).

## Decision

1. **Department & Position Hierarchy**:
   - Model `Department` as a self-referencing tree structure with cycle detection to prevent circular ancestry.
   - Model `JobPosition` as organizational role definitions scoped to departments.
2. **Employee Aggregate**:
   - Enforce tenant isolation via mandatory `organizationId`.
   - Maintain lifecycle states: `ACTIVE`, `ON_LEAVE`, `SUSPENDED`, `TERMINATED`.
   - Enforce employment classification types: `FULL_TIME`, `PART_TIME`, `CONTRACT`, `TEMPORARY`, `INTERN`.
3. **Effective-Dated Compensation History**:
   - Store compensation tiers in `EmployeeCompensation` with `effectiveFrom` and optional `effectiveUntil`.
   - Enforce non-overlapping temporal constraints per employee.
   - Use `DECIMAL(20, 4)` for all salary, allowance, and overtime rates.

## Consequences

- Preserves complete historical compensation audit trails.
- Guarantees data integrity across organizational structures and salary timelines.
