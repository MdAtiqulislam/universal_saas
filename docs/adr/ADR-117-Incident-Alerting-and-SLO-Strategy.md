# ADR-117: Incident Management, Alerting, and SLO Strategy

**Status:** Accepted  
**Date:** 2026-08-31  
**Milestone:** M38

## Context

Platform operational incidents have no formal tracking mechanism. There are no alert rules to detect threshold breaches automatically. No Service Level Objectives are defined or measured.

## Decision

### Incident Management

OperationalIncident model (distinct from M34 ServiceTicket — operational, not customer-facing).

Lifecycle: OPEN → ACKNOWLEDGED → INVESTIGATING → MITIGATED → RESOLVED → CLOSED (INV-332).

- incidentNumber is globally unique auto-assigned (INV-331): format 'INC-XXXXXXXX'.
- resolvedAt required for RESOLVED/CLOSED (INV-333).
- CLOSED is terminal — no further transitions (INV-334).
- organizationId nullable — platform-level incidents have no tenant scope.
- Idempotent creation using IdempotencyService (M36).

### Alert Rules (INV-335, INV-336, INV-337, INV-338)

OperationalAlertRule defines threshold + window + cooldown. AlertEvaluator checks: if currentValue > threshold AND no TRIGGERED event within cooldownSeconds → create new OperationalAlertEvent.

Lifecycle: TRIGGERED → ACKNOWLEDGED → RESOLVED. resolvedAt required on RESOLVED (INV-338). Cooldown prevents alert storms (INV-336). Alert deduplication uses ConcurrencyUtil.boundedParallel for 100-simultaneous evaluations.

### SLO Monitoring (INV-348, INV-349, INV-350)

ServiceLevelObjective tracks targetValue (percentage or threshold), windowDays, currentValue, status (HEALTHY/AT_RISK/BREACHED), breachCount.

Compliance calculation is deterministic: if currentValue < targetValue → BREACHED; if within 5% → AT_RISK; otherwise HEALTHY (INV-349).

TENANT-scoped SLOs are always queried with organizationId filter (INV-350). PLATFORM-scoped SLOs require operations.admin permission.

## Consequences

- Operational teams can create runbooks linked to incident records.
- Alert deduplication prevents notification fatigue.
- SLO breach count enables trend analysis.
- No external notification dispatch in M38 (deferred to M39 for PagerDuty/Slack integration).
