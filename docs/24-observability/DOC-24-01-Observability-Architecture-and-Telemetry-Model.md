# DOC-24-01: Observability Architecture & Telemetry Model

**Milestone:** M38 — Platform Observability, Reliability & Operational Excellence Foundation  
**Status:** APPROVED  
**Classification:** Internal Technical Architecture

---

## 1. Executive Summary

Milestone M38 introduces a unified, multi-tenant operational observability layer for the Universal Business Operations SaaS platform. Spanning all 37 foundational and business modules (M01–M37), M38 provides real-time telemetry, structured logging, request tracing, dependency health monitoring, operational incident management, automated alerting, and Service Level Objective (SLO) compliance tracking.

---

## 2. Core Telemetry Pillars

```
+-------------------------------------------------------------------------+
|                              Next.js Web                                |
|           (/admin/operations — Operations Dashboard & SLO View)         |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                              NestJS API                                 |
|  +-------------------------------------------------------------------+  |
|  |                 RequestLoggingInterceptor                         |  |
|  |       (Generates X-Request-Id, Wraps AsyncLocalStorage)           |  |
|  +-------------------------------------------------------------------+  |
|                                   |                                     |
|                                   v                                     |
|  +-------------------------------------------------------------------+  |
|  |                   CorrelationContextService                       |  |
|  |       (RequestId, CorrelationId, TenantId, UserId, Route)         |  |
|  +-------------------------------------------------------------------+  |
|            |                      |                     |               |
|            v                      v                     v               |
|  +-------------------+  +-------------------+  +---------------------+  |
|  | StructuredLogger  |  |  MetricsService   |  |   HealthService     |  |
|  | (Redacted JSON)   |  | (In-Memory Bounded|  | (DB, Cache, Jobs)   |  |
|  +-------------------+  +-------------------+  +---------------------+  |
|            |                      |                     |               |
|            v                      v                     v               |
|  +-------------------+  +-------------------+  +---------------------+  |
|  | IncidentService   |  | AlertingService   |  |    SloService       |  |
|  | (SEV1-4 Lifecycle)|  | (Cooldown & Rules)|  | (Deterministic Comp)|  |
|  +-------------------+  +-------------------+  +---------------------+  |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                             PostgreSQL                                  |
|  - operational_incidents        - operational_alert_rules               |
|  - operational_alert_events     - service_level_objectives              |
|  - operational_errors           - audit_logs / security_events          |
+-------------------------------------------------------------------------+
```

### 2.1 Structured Logging (INV-326, INV-329)

Every log record emitted via `StructuredLoggingService` is serialized as structured JSON with mandatory standard keys:

- `timestamp`: ISO-8601 UTC timestamp.
- `level`: `TRACE` | `DEBUG` | `INFO` | `WARN` | `ERROR` | `FATAL`.
- `service`: `api`.
- `module`: Target module (e.g., `Accounting`, `Inventory`, `Security`).
- `environment`: `production` | `staging` | `development`.
- `requestId`: Trace identifier propagated across subcomponents.
- `correlationId`: Upstream or end-to-end request identifier.
- `organizationId`: Multi-tenant organization UUID (if authenticated).
- `userId`: Authenticated actor UUID (if present).
- `route` & `method`: HTTP path and verb.
- `durationMs` & `statusCode`: Latency and response code.
- `event`: Domain or operational event name.

**Sanitization & Redaction:** All fields pass through `AuditSanitizerService` and explicit regex filters, redacting passwords, session tokens, bearer JWTs, API keys, and national identifiers.

### 2.2 In-Process Request Correlation (INV-326, INV-327)

- Powered by Node.js `AsyncLocalStorage` via `CorrelationContextService`.
- Context is created per HTTP request lifecycle and cleaned up automatically upon socket termination.
- Strict cross-request isolation prevents context leakage under 10,000+ concurrent requests.

### 2.3 Multi-Dimensional Metrics (INV-341, INV-342, INV-343, INV-344)

- In-memory bounded data structures prevent unconstrained memory growth (histograms capped at 1,000 observations per dimension).
- Metric types: `Counter` (strictly monotonic), `Gauge` (instantaneous values), and `Histogram` (with percentile calculation for p50, p95, p99).
- Scoping model:
  - `platform.*`: Global platform metrics requiring `operations.metrics.view` or `operations.admin`.
  - `tenant.<orgId>.*`: Tenant-isolated metrics strictly scoped to organization boundary.

### 2.4 Health Probes & Dependency Verification (INV-339, INV-340)

- `GET /api/v1/operations/health/live`: Lightweight unauthenticated liveness check returning `{ "status": "UP" }`.
- `GET /api/v1/operations/health/ready`: Dependency readiness check verifying PostgreSQL connection without leaking topology details.
- `GET /api/v1/operations/health`: Authenticated multi-point diagnostics covering PostgreSQL, Cache, and Background Job queues.

---

## 3. Data Retention & Privacy

| Model / Telemetry Stream           | Retention Strategy                   | Storage Medium                          |
| :--------------------------------- | :----------------------------------- | :-------------------------------------- |
| **Operational Incidents**          | Indefinite (Immutable Audit History) | PostgreSQL (`operational_incidents`)    |
| **Operational Alert Rules**        | Indefinite                           | PostgreSQL (`operational_alert_rules`)  |
| **Alert Events**                   | 90 Days Rolling TTL                  | PostgreSQL (`operational_alert_events`) |
| **SLO Definitions**                | Indefinite                           | PostgreSQL (`service_level_objectives`) |
| **Operational Error Fingerprints** | 90 Days Rolling TTL                  | PostgreSQL (`operational_errors`)       |
| **In-Memory Metrics**              | Process Lifetime (Reset on Restart)  | Node.js RAM (Bounded Map)               |
