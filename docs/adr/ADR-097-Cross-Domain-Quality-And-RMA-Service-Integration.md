# ADR-097: Cross-Domain Quality and RMA Service Integration

## Status

Accepted

## Context

Repairs often originate from customer returns (M32 RMA) or require rigorous post-service quality inspection (M31 Quality Management) before equipment can be safely returned to customers. M34 must reuse existing authoritative quality and returns engines rather than creating duplicate processes.

## Decision

1. When return requests in M32 specify `REPAIR` or `REWORK` dispositions, generate corresponding `ServiceOrder` records linked via `sourceRmaId` with duplicate prevention invariants.
2. For serviced equipment requiring quality verification, create `QualityInspectionLot` aggregates linked via `inspectionLotId` in M31.
3. Enforce Invariant 248: Service orders requiring quality inspection cannot transition to `COMPLETED` until an inspection lot is decided with `ACCEPT` or `ACCEPT_WITH_DEVIATION`.

## Consequences

### Positive

- Unified quality assurance standards applied identically to manufacturing and repair.
- Direct traceability from customer RMA returns through workshop repair and customer handover.
- Full compliance with industrial safety and quality management standards.

### Negative

- Completion of service orders is gated on quality inspection decisions when enabled.
