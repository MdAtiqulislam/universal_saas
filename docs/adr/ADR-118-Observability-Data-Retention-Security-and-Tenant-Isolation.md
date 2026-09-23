# ADR-118: Observability Data Retention, Security, and Tenant Isolation

**Status:** Accepted  
**Date:** 2026-08-31  
**Milestone:** M38

## Context

Observability data must respect the platform's multi-tenant isolation model, security requirements, and data retention policies. Unbounded observability tables pose storage and compliance risks.

## Decision

### Data Retention Strategy

| Data Type                                  | Retention                                | Storage    |
| ------------------------------------------ | ---------------------------------------- | ---------- |
| Raw request metrics (counters, histograms) | Bounded in-memory, lost on restart       | RAM only   |
| Aggregated hourly/daily metrics            | Not persisted (v1)                       | RAM only   |
| Operational incidents                      | Long-term (no TTL)                       | PostgreSQL |
| Alert rules                                | Long-term (no TTL)                       | PostgreSQL |
| Alert events                               | 90-day TTL via scheduled purge job (M39) | PostgreSQL |
| SLO records                                | Long-term (no TTL)                       | PostgreSQL |
| Operational errors                         | 90-day TTL via scheduled purge job (M39) | PostgreSQL |
| Audit logs                                 | Existing M06 policy (immutable)          | PostgreSQL |
| Security events                            | Existing M37 policy                      | PostgreSQL |

### Security Requirements (M37 remains authoritative)

All operational API endpoints use JwtAuthGuard + PermissionGuard. Health liveness/readiness are public but return minimal data (INV-340).

Operational APIs never expose:

- Raw secrets, tokens, passwords, authorization headers
- Full stack traces in production responses
- Sensitive SQL query parameters in slow query logs
- Another tenant's operational data

OperationalError.message and metadata are sanitized via AuditSanitizerService before persistence (INV-329). stackHash is a SHA-256 fingerprint, not raw stack trace (INV-330).

### Tenant Isolation (INV-343, INV-344, INV-345, INV-346, INV-347, INV-350)

Two metric scopes:

- **PLATFORM** — visible only to users with `operations.admin` or `operations.metrics.view` at system level (operator-only).
- **TENANT** — visible only within the tenant's organizationId scope.

All IncidentService, AlertingService, SloService, OperationalErrorsService queries include organizationId filter when scope = TENANT.

Background job observability (INV-345): JobService.listJobs() already scopes by organizationId. OperationalErrorsService similarly scopes.

### Failure Isolation

The observability system degrades, never cascades:

- MetricsService.incrementCounter() is synchronous and never throws.
- OperationalErrorsService.record() catches all DB errors internally.
- HealthService returns DOWN/UNKNOWN on dependency failure instead of throwing.
- StructuredLoggingService falls back to NestJS Logger on formatter failure.

## Consequences

- No unbounded PostgreSQL growth from raw metrics.
- Tenant data isolation maintained across all observability APIs.
- Platform-level metrics require explicit privilege escalation.
- M39 should implement scheduled purge jobs for 90-day TTL tables.
