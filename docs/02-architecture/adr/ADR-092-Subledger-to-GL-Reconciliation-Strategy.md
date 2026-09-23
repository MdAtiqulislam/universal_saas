# ADR-092: Subledger-to-GL Reconciliation Strategy

## Status

Accepted

## Context

Subledgers (Accounts Payable, Accounts Receivable, Inventory Valuation, Tax Ledgers, Fixed Assets, Payroll) track detailed operational records that post summary or detailed journal entries to the General Ledger. Discrepancies can occur due to rounding, timing, or unposted source documents.

## Decision

1. **Automated Continuous Reconciliation**:
   - `getSubledgerReconciliation()` evaluates operational subledger aggregate balances against corresponding General Ledger account groupings as of a specific date or fiscal period end.
2. **Explicit Variance Reporting**:
   - Every reconciliation check reports the `subledgerBalance`, `glBalance`, and explicit `difference` (absolute variance).
   - If difference is zero (or within configurable threshold), status is `MATCHED`; otherwise `MISMATCH`.
3. **No Silent Mutations**:
   - Reconciliation is strictly diagnostic and read-only. It NEVER silently adjusts GL accounts or mutates source transaction amounts. Discrepancies must be investigated and resolved via standard adjustment journal entries (`PERIOD_ADJUSTMENT`).

## Consequences

### Positive

- Transparent audit trail for financial discrepancies.
- Fast diagnostic pinpointing of timing or missing posting errors.
- Guarantees financial ledger integrity without opaque background auto-corrections.
