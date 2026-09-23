# ADR-130: API Usage Telemetry, Privacy and Retention Strategy

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M41

## Context

High-throughput public API platforms generate significant telemetry. To provide rate tracking, billing metrics, SLA monitoring, and developer usage insights without causing performance degradation or privacy violations, telemetry ingestion and retention must be strictly bounded and privacy-compliant.

## Decision

1. **Non-Blocking Telemetry Capture**: Incoming API calls are intercepted via `ApiUsageInterceptor`. Execution timing is measured asynchronously and persisted through `ApiUsageService` without blocking or delaying HTTP response delivery.
2. **Privacy Preservation & Zero Secret Leakage**:
   - IP addresses are never stored in plaintext. They are salted and hashed using SHA-256 (`ipHash`) to allow anomaly and geographic distribution detection while adhering to GDPR/privacy mandates.
   - Raw API keys and `Authorization` headers are never stored in telemetry records.
   - Routes are normalized by stripping query strings and variable path parameters.
3. **Compound Database Indexing**: The `ApiUsageRecord` table is indexed across `[organizationId, createdAt]`, `[organizationId, apiKeyId, createdAt]`, `[organizationId, route, createdAt]`, and `[organizationId, statusCode, createdAt]` to ensure fast aggregation queries and predictable sub-millisecond index scans.
4. **Bounded Telemetry Export**: Tenants can export their usage logs as CSV. Exports are hard-capped at 10,000 records per export request, strictly filtered by the authenticated `organizationId`, and emit an audit trail event (`api_usage.exported`).
5. **M38 Platform Metrics Integration**: In addition to database persistence, every public API request increments M38 `MetricsService` counters (`platform.api.requests.total`, `platform.api.requests.<status_class>`).

## Consequences

- Tenants receive real-time visibility into their API consumption, latency trends, and error distributions.
- Telemetry storage respects privacy standards and database performance constraints.
