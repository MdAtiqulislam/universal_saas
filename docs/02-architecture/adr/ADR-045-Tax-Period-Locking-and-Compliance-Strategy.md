# ADR-045: Tax Period Locking and Compliance Strategy

## Context

Tax authorities require periodic filings (monthly, quarterly, annual) that, once filed, must not be retroactively modified without explicit tax adjustment entries. A mechanism is required to freeze historical periods and enforce filing immutability.

## Decision

1. **Tax Period Lifecycle**:
   - `OPEN`: Transactions within the period range are recorded normally.
   - `PREPARED`: Summaries (`totalTaxableSales`, `totalOutputTax`, `totalTaxablePurchases`, `totalInputTax`, `netTaxPayable`) are aggregated and transactions linked.
   - `FILED`: Tax returns submitted to the tax authority.
   - `LOCKED`: Period is permanently frozen. The tax transaction recording engine strictly rejects any new transactions falling within the locked period's start and end dates.
2. **Adjustments**: Corrections to locked periods must be booked in subsequent open periods as explicit `MANUAL_ADJUSTMENT` entries or tax credit/debit notes.

## Consequences

- Guarantees regulatory compliance and audit defensibility.
- Prevents silent historical balance drift.
