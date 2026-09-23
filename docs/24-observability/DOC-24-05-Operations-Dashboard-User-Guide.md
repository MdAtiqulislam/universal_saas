# DOC-24-05: Operations Dashboard User Guide

**Milestone:** M38 — Platform Observability, Reliability & Operational Excellence Foundation  
**Status:** APPROVED  
**Classification:** Operational User Guide

---

## 1. Overview

The Platform Operations Dashboard (`/admin/operations`) provides real-time telemetry and management controls for platform operators and tenant administrators.

---

## 2. Dashboard Components

```
+---------------------------------------------------------------------------------------+
|  [UP] API: 99.98%  |  [p95] 120ms  |  [ERR] 0.02%  |  [DB] UP  |  [CACHE] 88% Hit    |
+---------------------------------------------------------------------------------------+
|  [Tab: Overview]  |  [Tab: Incidents]  |  [Tab: Alert Rules]  |  [Tab: SLO Tracking]  |
+---------------------------------------------------------------------------------------+
```

### 2.1 Top-Level KPI Ribbon

- **API Availability**: Real-time calculated uptime percentage.
- **p95 Latency**: 95th percentile response time across all routes.
- **Error Rate**: Percentage of 5xx server errors relative to total throughput.
- **Database Status**: Health badge (`UP`, `DEGRADED`, `DOWN`).
- **Cache Hit Rate**: Percentage of cache queries resolved from RAM.
- **Active Incidents**: Unresolved SEV1–SEV4 incident counter.

### 2.2 Operational Panels

1. **System Health Panel**: Subsystem status for PostgreSQL, In-Memory Cache, and Background Job workers.
2. **API Performance Panel**: Latency breakdown across p50, p95, and p99 percentiles.
3. **Error Rate & Taxonomy Panel**: Recent error events categorized with sanitized messages.
4. **Background Jobs Panel**: Queue depth, currently processing jobs, retry count, and failure rates.
5. **Security Telemetry Panel**: Aggregated threat events, failed logins, lockouts, and rate limit triggers.
6. **Incident Management Panel**: Interactive triage view to acknowledge, resolve, and close incidents.
7. **Alert Rules & Events Panel**: Threshold configuration with cooldown suppression indicators.
8. **SLO Compliance Panel**: Target vs. actual compliance metrics with status badges (`HEALTHY`, `AT_RISK`, `BREACHED`).

---

## 3. RBAC Permissions Matrix

| Dashboard Feature                      | Required Permission                                        |
| :------------------------------------- | :--------------------------------------------------------- |
| View Dashboard & System Health         | `operations.view`, `operations.health.view`                |
| View Metrics & Performance Percentiles | `operations.metrics.view`                                  |
| View Operational Error Records         | `operations.errors.view`                                   |
| View Background Job Telemetry          | `operations.jobs.view`                                     |
| View Cache Telemetry                   | `operations.cache.view`                                    |
| View Security Telemetry                | `operations.security.view`                                 |
| Triage & Manage Incidents              | `operations.incidents.view`, `operations.incidents.manage` |
| Manage Alert Rules                     | `operations.alerts.view`, `operations.alerts.manage`       |
| View SLO Compliance                    | `operations.slo.view`                                      |
