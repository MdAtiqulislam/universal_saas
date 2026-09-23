# ADR-116: Health, Metrics, and Dependency Monitoring Strategy

**Status:** Accepted  
**Date:** 2026-08-31  
**Milestone:** M38

## Context

The platform has no standardized health check endpoints, no dependency monitoring, and no metrics collection infrastructure. Kubernetes-style liveness/readiness probes are impossible without these.

## Decision

### Health Checks

Three endpoints:

- `GET /api/v1/operations/health/live` — public, returns `{ status: 'UP' }` if process is alive (INV-340).
- `GET /api/v1/operations/health/ready` — public, returns `{ status: 'UP' }` if DB is reachable.
- `GET /api/v1/operations/health` — authenticated (operations.health.view), returns full dependency status.

Dependencies checked: PostgreSQL (`SELECT 1`), CacheService (get/set round-trip), JobService (pending count). Status: UP, DEGRADED, DOWN, UNKNOWN (INV-339).

Overall status = DEGRADED if any non-critical component is DOWN. Overall = DOWN only if database is unreachable.

### Metrics

In-memory Map-based metrics with bounded memory (max 1000 histogram values per key). Types: COUNTER (monotonic, INV-341), GAUGE, HISTOGRAM (p50/p95/p99). Metric scope: PLATFORM (privileged access required, INV-344) or TENANT (tenant-scoped, INV-343).

### Slow Request/Query Detection

- Slow request threshold: SLOW_REQUEST_THRESHOLD_MS (default 1000ms, env configurable, M38 spec §14 says 500ms for queries).
- Slow query threshold: SLOW_QUERY_THRESHOLD_MS (default 500ms, env configurable).
- Logged as WARN with sanitized route/module context — no raw SQL parameters logged.

## Consequences

- Health endpoints enable Kubernetes liveness/readiness probes without configuration changes.
- In-memory metrics lost on restart — acceptable for v1; persistent adapter in M39.
- No additional npm packages required.
