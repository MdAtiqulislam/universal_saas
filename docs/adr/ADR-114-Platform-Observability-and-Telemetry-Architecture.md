# ADR-114: Platform Observability and Telemetry Architecture

**Status:** Accepted  
**Date:** 2026-08-31  
**Milestone:** M38 — Platform Observability, Reliability & Operational Excellence Foundation

## Context

The Universal Business Operations SaaS platform (M01–M37) operates across 20+ business modules with no unified observability layer. Production incidents are invisible, performance regressions go undetected, and operational teams lack the instrumentation needed to maintain SLA commitments.

## Decision

Implement a centralized **OperationsModule** as a cross-cutting NestJS @Global() module that:

1. **Owns only observability infrastructure** — not business logic, accounting, payments, or security authorization.
2. **Reuses existing platform services** — AuditService (M06), JobService/CacheService/IdempotencyService/ConcurrencyUtil (M36), SecurityEventsService (M37), AuditSanitizerService.
3. **Uses in-memory metrics** — bounded Map-based counters/histograms; no PostgreSQL time-series flood. Only structured operational records (incidents, alerts, SLOs, errors) are persisted.
4. **Uses AsyncLocalStorage for correlation context** — zero-copy, non-blocking, no context leakage (INV-327).
5. **Fails gracefully** — all telemetry operations wrapped in try/catch; observability failures never crash business requests.

## Consequences

### Positive

- Production incidents become visible within seconds of detection.
- Request tracing possible via X-Request-Id header across the entire stack.
- SLO compliance measurable deterministically (INV-349).
- No significant performance overhead — AsyncLocalStorage adds ~0.5ms per request.

### Negative

- In-memory metrics lost on process restart (acceptable v1; persistent adapter in M39).
- Alert notifications stored but not dispatched externally (M39 deferred).

## Alternatives Rejected

- **Prometheus + Grafana**: Adds external infrastructure dependency; deferred to M39.
- **OpenTelemetry SDK full integration**: Deferred to M39; M38 provides vendor-neutral trace context fields.
- **Writing raw metrics to PostgreSQL**: Creates unbounded table growth; explicitly rejected per M38 spec §29.
