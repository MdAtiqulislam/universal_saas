# ADR-084: Non-Conformance and CAPA Remediation Pipeline

## Status

Accepted (Milestone M31)

## Context

When materials fail quality standards or when defects occur in production or customer sites, enterprise quality systems mandate formal Non-Conformance Reporting (NCR) and Corrective & Preventive Actions (CAPA).

A disjointed quality workflow risks defective materials leaking into finished goods or customer shipments, and recurrent failures without permanent root-cause elimination.

## Decision

1. **End-to-End Non-Conformance Lifecycle**:
   - `NonConformance` tracks issues through structured milestones: `OPEN` -> `CONTAINED` -> `INVESTIGATING` -> `ROOT_CAUSE_IDENTIFIED` -> `DISPOSITIONED` -> `CAPA_REQUIRED` -> `CLOSED`.
   - Immediate containment locks affected material via `QualityHold`.
   - Dispositions include `SCRAP`, `REWORK`, `RETURN_TO_SUPPLIER`, and `ACCEPT_WITH_DEVIATION`.

2. **CAPA Escalation & Verification Pipeline**:
   - High-severity or recurring NCRs escalate to `CAPA` records.
   - The CAPA lifecycle enforces: `DRAFT` -> `OPEN` -> `IN_PROGRESS` -> `PENDING_VERIFICATION` -> `VERIFIED` -> `CLOSED`.
   - Strict invariant: An NCR cannot be closed while associated CAPAs remain unverified/open.
   - CAPA closure requires documented verification audit notes and long-term effectiveness reviews.

3. **Material Hold Synchronization**:
   - Quality holds (`QualityHold`) track isolated inventory quantities, reasons, and disposition statuses.
   - Holds are released only after explicit inspection clearance or completed disposition actions.

## Consequences

### Positive

- Closed-loop remediation satisfying rigorous ISO 9001:2015 Clause 10.2 requirements.
- Full traceability linking inspection failures, NCR containment, root causes, corrective actions, and physical inventory holds.
- Invariant protection preventing premature closure of unverified quality non-conformances.

### Negative

- Multi-step workflow introduces procedural rigor requiring documented investigations prior to ticket closure.
