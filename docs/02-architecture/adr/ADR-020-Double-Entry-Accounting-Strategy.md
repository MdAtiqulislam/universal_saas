# ADR-020: Double-Entry Bookkeeping and Exact Precision Strategy

## Status

Accepted

## Context

Financial records require mathematical balance and immutability. Floating-point arithmetic in JavaScript (`number`, `parseFloat`) is vulnerable to binary rounding errors (e.g. `0.1 + 0.2 != 0.3`), which is unacceptable in general ledger bookkeeping. We need an exact decimal representation and strict double-entry verification.

## Decision

### 1. Exact Decimal Representation

All journal line debit and credit amounts are stored in PostgreSQL using `DECIMAL(20, 4)` and evaluated in application services using Prisma `Decimal` (based on `decimal.js`). Standard JavaScript floating-point arithmetic is prohibited across all accounting calculations.

### 2. Line Invariants

Each `JournalLine` row satisfies:

1. `debit >= 0` AND `credit >= 0`
2. Exactly one of `debit > 0` OR `credit > 0` is true (`chk_journal_line_xor`).
3. Targeted account must belong to the same tenant organization and be active.

### 3. Balanced Journal Invariant

Before transitioning a `JournalEntry` from `DRAFT` to `POSTED`, the `AccountingPostingService` evaluates:

$$\sum_{i=1}^{N} \text{debit}_i = \sum_{i=1}^{N} \text{credit}_i$$

where $N \ge 2$. If the sums differ by even $0.0001$, posting is rejected and the transaction aborted.

## Consequences

- **Positive**: Strict financial auditability; prevents rounding anomalies in financial reports.
- **Negative**: Requires strict validation of input line arrays before saving.
