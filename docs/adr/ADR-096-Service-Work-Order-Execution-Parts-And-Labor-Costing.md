# ADR-096: Service Work Order Execution, Parts & Labor Costing

## Status

Accepted

## Context

Service work orders represent the authoritative operational aggregate for field and workshop repairs. Executing repairs requires issuing inventory parts, tracking technician time, and maintaining real-time costing and pricing breakdowns with full double-entry precision.

## Decision

1. Implement `ServiceOrder` aggregate governing the lifecycle (`DRAFT`, `RELEASED`, `IN_PROGRESS`, `QUALITY_CHECK`, `COMPLETED`, `HANDED_OVER`, `CLOSED`).
2. Track replacement components via `ServicePartRequirement` with stock reservation, issuance from inventory layers (M09/M19), and return of unused components.
3. Track technician labor via `ServiceLaborEntry` capturing billable hours, actual hours, standard labor rates, and internal technician cost rates. Finalized entries are immutable.
4. Calculate parts cost, labor cost, total cost, warranty cost, customer charge, and net service margin using exact `Prisma.Decimal` arithmetic.

## Consequences

### Positive

- Strict mathematical integrity for financial costing and customer billing.
- Real-time stock reservation prevents parts shortages during service dispatches.
- Prevention of duplicate or inflated parts issuance via return tracking.

### Negative

- Requires technician discipline in logging actual versus billable hours.
