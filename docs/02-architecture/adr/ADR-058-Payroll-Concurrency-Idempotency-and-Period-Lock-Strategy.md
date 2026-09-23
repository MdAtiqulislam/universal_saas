# ADR-058: Payroll Concurrency, Idempotency & Period Lock Strategy

## Status

Accepted

## Context

High-concurrency environments with multiple payroll accountants or automated scheduled payroll tasks can trigger race conditions during calculation, approval, GL posting, and disbursement operations.

## Decision

1. **State Machine Locking**:
   - Strict status transition gates:
     - Only `DRAFT`/`OPEN`/`CALCULATING`/`CALCULATED` can be calculated.
     - Only `CALCULATED` can be approved.
     - Only `APPROVED` can be posted to General Ledger.
     - Only `POSTED` can be disbursed/paid.
     - Only `POSTED`/`PAID` can be closed.
     - `CLOSED` periods are permanently locked against any modifications or new inputs.
2. **Transaction Isolation & Atomicity**:
   - Execute all calculations, postings, and disbursements within database transactions (`prisma.$transaction`).
   - Clean up draft artifacts when recalculating before approval.
3. **Idempotent Payment & Unique Constraints**:
   - Disallow re-disbursement on runs where `paymentId` is already set.
   - Enforce uniqueness on `[organizationId, periodNumber]`, `[organizationId, runNumber]`, and `[payrollRunId, employeeId]`.

## Consequences

- High-concurrency worker loads (e.g., 100 concurrent requests) execute deterministically without race conditions or data corruption.
- Guarantees financial stability across distributed payroll workflows.
