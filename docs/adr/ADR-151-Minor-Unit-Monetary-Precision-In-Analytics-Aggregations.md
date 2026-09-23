# ADR-151: Minor-Unit Monetary Precision in Analytics Aggregations

## Status

Accepted

## Context

Standard IEEE-754 64-bit floating point arithmetic produces rounding drift when summing financial currencies (e.g. `0.1 + 0.2 === 0.30000000000000004`). In enterprise billing, invoice reconciliation, and financial analytics, even a single cent variance creates reconciliation failures and compliance breaches.

## Decision

All financial measures in the analytics platform strictly inherit and reuse the **M42 minor-unit integer arithmetic model**:

1. **Catalog Flagging**: Any measure representing money (e.g., `totalRevenue`, `discountAmount`, `stockValuation`, `refundAmount`, `totalAmount`) is flagged with `isCurrency: true` and `unit: 'cents'`.
2. **BigInt Accumulator**: The aggregation engine accumulates sums using integer cents (`BigInt` or exact integer math), ensuring zero decimal floating-point drift.
3. **Frontend Formatting**: The UI receives integer cents and divides by 100 for display (e.g. `50000` cents displayed as `$500.00`).
4. **No Float Conversions in Pipeline**: Calculations never convert to float until final display formatting.

## Consequences

### Positive

- Mathematically exact balance sheet and revenue aggregations.
- Complete alignment with M42 Billing and Accounting ledger precision.
- Audit compliance across multi-currency operations.

## Related Invariants

- `INV-507`: Strict Minor-Unit Monetary Precision
