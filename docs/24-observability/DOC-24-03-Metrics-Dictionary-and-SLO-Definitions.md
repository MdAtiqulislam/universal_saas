# DOC-24-03: Metrics Dictionary & SLO Definitions

**Milestone:** M38 — Platform Observability, Reliability & Operational Excellence Foundation  
**Status:** APPROVED  
**Classification:** Reference Catalog

---

## 1. Canonical Metrics Dictionary

| Metric Key                  | Type      | Scope             | Unit         | Description                                                          |
| :-------------------------- | :-------- | :---------------- | :----------- | :------------------------------------------------------------------- |
| `http_requests_total`       | Counter   | Platform          | count        | Cumulative total of processed HTTP requests.                         |
| `http_requests_5xx_total`   | Counter   | Platform          | count        | Cumulative total of HTTP 5xx responses.                              |
| `http_requests_4xx_total`   | Counter   | Platform          | count        | Cumulative total of HTTP 4xx client errors.                          |
| `api_request_duration_ms`   | Histogram | Platform / Tenant | milliseconds | Request latency distribution tracking p50, p95, and p99 percentiles. |
| `db_query_duration_ms`      | Histogram | Platform          | milliseconds | Database query execution time distribution.                          |
| `db_active_connections`     | Gauge     | Platform          | count        | Current active connection pool utilization.                          |
| `cache_hits_total`          | Counter   | Platform          | count        | Cumulative total of in-memory cache hit lookups.                     |
| `cache_misses_total`        | Counter   | Platform          | count        | Cumulative total of in-memory cache miss lookups.                    |
| `jobs_queued_count`         | Gauge     | Platform / Tenant | count        | Number of pending background execution jobs.                         |
| `jobs_failed_total`         | Counter   | Platform / Tenant | count        | Cumulative total of failed background job executions.                |
| `auth_failed_logins_total`  | Counter   | Platform / Tenant | count        | Number of failed authentication attempts.                            |
| `security_incidents_active` | Gauge     | Platform / Tenant | count        | Currently unresolved security and operational incidents.             |

---

## 2. Service Level Objectives (SLOs) & Targets (INV-348, INV-349, INV-350)

### 2.1 Core SLO Table

| Objective Name             | Metric Key               | Scope    | Target   | Window  | Status Classification                                                   |
| :------------------------- | :----------------------- | :------- | :------- | :------ | :---------------------------------------------------------------------- |
| **API Availability**       | `api_uptime_percentage`  | Platform | 99.9%    | 30 Days | >= 99.9% -> HEALTHY<br>94.9% - 99.89% -> AT_RISK<br>< 94.9% -> BREACHED |
| **API p95 Latency**        | `api_p95_latency_ms`     | Platform | <= 250ms | 7 Days  | <= 250ms -> HEALTHY<br>251ms - 300ms -> AT_RISK<br>> 300ms -> BREACHED  |
| **Database Query p95**     | `db_query_p95_ms`        | Platform | <= 100ms | 7 Days  | <= 100ms -> HEALTHY<br>101ms - 150ms -> AT_RISK<br>> 150ms -> BREACHED  |
| **Job Execution Success**  | `job_success_rate`       | Tenant   | 99.5%    | 30 Days | >= 99.5% -> HEALTHY<br>95.0% - 99.49% -> AT_RISK<br>< 95.0% -> BREACHED |
| **Invoice Processing SLA** | `invoice_generation_sla` | Tenant   | 99.0%    | 30 Days | >= 99.0% -> HEALTHY<br>< 99.0% -> BREACHED                              |

### 2.2 Deterministic Compliance Calculation (INV-349)

The status of an SLO is deterministically calculated on each observation:
$$\text{Status} = \begin{cases} \text{BREACHED}, & \text{if } \text{currentValue} < \text{targetValue} \\ \text{AT\_RISK}, & \text{if } \text{currentValue} < \text{targetValue} \times 1.05 \\ \text{HEALTHY}, & \text{otherwise} \end{cases}$$

Breach counts are incremented when an SLO transitions from non-breached to `BREACHED`.
