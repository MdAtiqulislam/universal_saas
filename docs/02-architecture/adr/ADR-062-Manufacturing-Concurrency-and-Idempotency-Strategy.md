# ADR-062: Manufacturing Concurrency and Idempotency Strategy

## Status

Accepted

## Context

High-concurrency manufacturing operations (such as parallel production releases, automated material batch issues, and parallel finished goods completions) require strict transaction isolation and idempotency to prevent over-consumption, race conditions, or duplicate inventory entries.

## Decision

1. **State Machine Locking**:
   - Only `DRAFT` orders can be released.
   - Only `RELEASED` orders can be started into `IN_PROGRESS`.
   - Only `RELEASED`, `IN_PROGRESS`, or `PARTIALLY_COMPLETED` orders can accept material issues.
   - Only `IN_PROGRESS` or `PARTIALLY_COMPLETED` orders can accept finished goods receipts.
   - Only `COMPLETED` or `PARTIALLY_COMPLETED` orders can be closed.
   - `CLOSED` and `CANCELLED` orders are permanently locked against modifications or issuances.
2. **Database Transactions**:
   - Wrap all cross-table inventory stock mutations, cost layer updates, line updates, and journal creations in `prisma.$transaction`.
3. **Serial Number Idempotency**:
   - Enforce single-use validation on serial numbers during issuance and uniqueness on new serials created during completion.

## Consequences

- High-concurrency worker loads (100 parallel workers) execute deterministically with 1 success and 99 rejected without data corruption.
- Guarantees financial and stock consistency under heavy production loads.
