# DOC-24-02: Operational Runbooks & Incident Management

**Milestone:** M38 — Platform Observability, Reliability & Operational Excellence Foundation  
**Status:** APPROVED  
**Classification:** Standard Operating Procedures (SOP)

---

## 1. Incident Severity Matrix (INV-326)

| Severity            | Definition                                                                                             | Target Triage Time | Target Resolution Time | Examples                                                                               |
| :------------------ | :----------------------------------------------------------------------------------------------------- | :----------------- | :--------------------- | :------------------------------------------------------------------------------------- |
| **SEV1 (Critical)** | Catastrophic failure, total platform outage, data corruption risk, or primary database unavailability. | < 5 Minutes        | < 1 Hour               | Database cluster unreachable, 100% API failure rate, payment double-charge bug.        |
| **SEV2 (Major)**    | Core workflow impaired for multiple tenants with no workaround available.                              | < 15 Minutes       | < 4 Hours              | Invoicing engine down, inventory reservation failure, background job runner stalled.   |
| **SEV3 (Minor)**    | Non-critical service degradation; workaround is available.                                             | < 1 Hour           | < 24 Hours             | Reporting export latency, slow search queries, single notification worker queue delay. |
| **SEV4 (Low)**      | Negligible customer impact; cosmetic or minor administrative bug.                                      | < 4 Hours          | < 3 Days               | Typo in email template, minor dashboard UI glitch, non-critical telemetry missing.     |

---

## 2. Incident Lifecycle (INV-332, INV-333, INV-334)

```
+--------+       +--------------+       +---------------+
|  OPEN  | ----> | ACKNOWLEDGED | ----> | INVESTIGATING |
+--------+       +--------------+       +---------------+
                                                |
                                                v
+--------+       +--------------+       +---------------+
| CLOSED | <---- |   RESOLVED   | <---- |   MITIGATED   |
+--------+       +--------------+       +---------------+
```

1. **OPEN**: Incident detected via automated threshold alert (`ALERT`), continuous health probe (`AUTOMATED`), or manual operator submission (`MANUAL`). Unique identifier assigned automatically (`INC-XXXXXX`).
2. **ACKNOWLEDGED**: Incident Commander or on-call engineer acknowledges receipt within SLA window.
3. **INVESTIGATING**: Active root-cause analysis and log correlation using `requestId` and `stackHash`.
4. **MITIGATED**: Immediate risk mitigated (e.g., traffic redirected, rate limits applied, cache cleared).
5. **RESOLVED**: Permanent fix deployed and verified. `resolvedAt` and `resolution` fields mandatory (INV-333).
6. **CLOSED**: Post-mortem complete. Closed state is immutable and terminal (INV-334).

---

## 3. Operational Runbooks

### Runbook 1: PostgreSQL Connection Pool Exhaustion (SEV1)

- **Symptoms:** High HTTP 500 error rates, `PrismaClientKnownRequestError`, slow query alerts triggering.
- **Diagnostic Steps:**
  1. Inspect `/api/v1/operations/health` dependency diagnostics.
  2. Query `operational_errors` filtering by `category = DATABASE`.
- **Mitigation:**
  1. Check for long-running transactions locking rows via `pg_stat_activity`.
  2. Kill blocking connections if safe to do so.
  3. Increase connection pool maximum size in deployment configuration.

### Runbook 2: Background Job Queue Stalled (SEV2)

- **Symptoms:** Background jobs count growing continuously in `/api/v1/operations/jobs`.
- **Diagnostic Steps:**
  1. Query `background_jobs` table for jobs with `status = PROCESSING` and `updated_at < NOW() - INTERVAL '15 minutes'`.
- **Mitigation:**
  1. Release stuck jobs or mark failed with automated retry backoff.
  2. Restart worker processes to restore queue consumer loops.

### Runbook 3: Alert Storm Suppression & Cooldown (INV-336)

- When high-frequency errors trigger alerts, `cooldownSeconds` (default: 300s) prevents notification flooding.
- Operators can adjust rule thresholds via `PATCH /api/v1/operations/alerts/:id`.
