# ADR-031: Bank Reconciliation Strategy

## Status

Accepted

## Context

Tenants need to verify that financial transactions recorded in the General Ledger and M15 Payments match transactions reported by their banking institutions. A robust, tenant-isolated reconciliation session model is required to prevent unreconciled discrepancies, double reconciliations, and concurrent tampering.

## Decision

1. Introduce `BankReconciliation` model tracking `book_balance`, `statement_balance`, `reconciled_balance`, and `difference`.
2. A reconciliation session links to a specific `BankStatement` with a strict `UNIQUE(organization_id, statement_id)` constraint.
3. Completing a reconciliation requires all statement transactions to be reconciled (`MATCHED` or `ADJUSTED`) and difference resolved to 0.
4. Completing a reconciliation session automatically transitions the associated `BankStatement` to `LOCKED`, making all underlying transactions permanently immutable.

## Consequences

- Guarantees financial statement integrity without race conditions or partial reconciliation states.
- Reconciled statements cannot be modified, preventing historical tampering.
