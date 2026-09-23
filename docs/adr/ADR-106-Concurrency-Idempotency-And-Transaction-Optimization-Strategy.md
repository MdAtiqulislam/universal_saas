# ADR-106: Concurrency, Idempotency & Transaction Optimization Strategy

## Status

Accepted

## Context

High-concurrency mutations in enterprise platforms (payment captures, goods receipts, inventory reservations, quotation conversions) must prevent race conditions, double fulfillment, duplicate financial entries, and database transaction deadlocks.

## Decision

1. Implement tenant-scoped `IdempotencyService` backed by `idempotency_records` table with lifecycle states `PENDING`, `COMPLETED`, `FAILED`.
2. Reject concurrent duplicate requests with identical idempotency keys with `409 Conflict` during `PENDING` state.
3. Automatically replay cached HTTP status codes and response bodies for `COMPLETED` records.
4. Minimize database transaction duration by executing validation and parsing outside transaction blocks.
5. Provide bounded concurrency utilities (`chunkedExecution`, `boundedParallel`, `retryWithBackoff`) for controlled async execution.

## Consequences

- Guaranteed zero double-charges, zero duplicate ledger journals, and zero overselling.
- Resilient recovery from transient connection drops or serialization deadlocks.
