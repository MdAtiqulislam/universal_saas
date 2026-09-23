# ADR-137: Idempotent Usage Metering, Daily Aggregations and Financial Arithmetic

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M42

## Context

Consumption-based billing and API/job quotas require accurate, high-throughput usage tracking. In high-concurrency environments with network retries, duplicate usage events can cause overbilling, while real-time sum queries over millions of raw events degrade database performance.

## Decision

1. **Strict Idempotency by Construction**:
   - Every usage ingestion event requires an idempotent key (`INV-440`).
   - A unique compound constraint `[organizationId, idempotencyKey]` on `BillingUsageRecord` guarantees that duplicate events are recognized and returned immediately without double-incrementing quotas or invoice totals (`INV-441`).
2. **Dual-Layer Metering Storage**:
   - **Raw Audit Log**: `BillingUsageRecord` stores granular usage occurrences with exact timestamps and source metadata.
   - **Pre-Aggregated Rollups**: Daily rollups in `BillingUsageAggregate` (`unique([organizationId, metricKey, date])`) store pre-calculated sums for fast periodic reporting and invoice generation.
3. **Non-Negative Invariant**:
   - Raw usage quantities and aggregated totals must be non-negative integers (`INV-442`). Negative adjustments must be performed through explicit credit ledger entries (`BillingCredit`) rather than negative usage records.
4. **Deterministic Invoice Totals**:
   - Invoices are compiled using integer arithmetic: `totalAmount = subtotal + taxAmount - discountAmount - creditApplied` (`INV-447`).
   - Finalized invoices cannot be altered (`INV-445`). Adjustments require new credit or void records.

## Consequences

- Billing records are immune to network replay errors and duplicate ingestion spikes.
- Query performance for reports and dashboard gauges remains sub-millisecond even at enterprise scale.
