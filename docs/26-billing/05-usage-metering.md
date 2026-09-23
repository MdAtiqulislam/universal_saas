# 05. Usage Metering & Ingestion

## Metering Architecture

High-volume API, job, and compute events are tracked via `UsageMeteringService`:

- **Metric Registry (`BillingUsageMetric`)**: Configures metric keys, units (e.g., `requests`, `gigabytes`, `seats`), and aggregation types (`SUM`, `MAX`, `LAST`).
- **Raw Usage Records (`BillingUsageRecord`)**: Granular usage events storing tenant ID, metric key, quantity, timestamp, source, and idempotency key.
- **Daily Aggregates (`BillingUsageAggregate`)**: Aggregated sums grouped by `[organizationId, metricKey, date]` for sub-millisecond report generation and billing rollups.

## Invariant Guarantees

- **INV-438**: Records are strictly tenant scoped (`organizationId`).
- **INV-439**: Metric keys must exist in the catalog.
- **INV-440 & INV-441**: Strict idempotency prevents double-counting duplicate usage events via unique constraint `[organizationId, idempotencyKey]`.
- **INV-442**: Non-negative quantities ensure aggregates never drop below zero.
