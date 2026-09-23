# 19 — Operational & Telemetry Guide

## 8 Authoritative Search Reports

`SearchReportsService` provides 8 operational reports for monitoring discovery health:

1. **Overview**: Total searches, average latency, scope distribution, zero-result count.
2. **Latency Report**: p50, p95, and p99 percentiles for query execution.
3. **Zero Results Report**: Discovers discovery gaps where users searched for keywords with no matches.
4. **Scope Distribution**: Measures usage volume across CRM, Sales, Inventory, Finance, etc.
5. **Slow Queries**: Flags complex AST filter queries exceeding performance thresholds.
6. **Popular Queries**: Lists top 20 most frequent search terms.
7. **Saved Views Summary**: Aggregates total views created by visibility (`PERSONAL`, `SHARED`, `TENANT`).
8. **Alert Executions**: Telemetry on search alerts triggered, evaluated, and failed.

## Telemetry Sanitization (`INV-499`)

Analytics events are logged through `SearchAnalyticsService`:

- Query length and result count are captured.
- PII, passwords, SSNs, and credit cards are stripped.
- Client IP addresses and raw user identifiers are not exposed in reporting models.
