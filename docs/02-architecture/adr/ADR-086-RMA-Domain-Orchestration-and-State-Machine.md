# ADR-086: RMA Domain Orchestration and State Machine

## Context

Reverse logistics and return merchandise authorization (RMA) require tracking returned physical items across multi-step review, authorization, receipt, inspection, disposition, and resolution cycles. Without a centralized state machine, return transactions risk non-deterministic state transitions, unauthorized inventory re-entry, and inconsistent financial postings across Customer Credit Notes, Supplier Debit Notes, and inventory balance adjustments.

## Decision

We establish an immutable, transactional state machine for `ReturnRequest` and `ReturnRequestLine` entities:

1. Lifecycle Progression:
   `DRAFT` -> `SUBMITTED` -> `UNDER_REVIEW` -> `AUTHORIZED` -> `AWAITING_RETURN` / `IN_TRANSIT` -> `RECEIVED` -> `INSPECTION_REQUIRED` / `INSPECTING` -> `DISPOSITION_PENDING` -> `RESOLVED` -> `CLOSED`.
2. Terminal States:
   `CLOSED` and `RESOLVED` lock `isImmutable = true`, preventing further mutations.
   `REJECTED`, `CANCELLED`, and `VOIDED` abort workflows with auditable rationale.
3. Multi-Tenant Composite Key:
   Keyed by `(organizationId, returnNumber)` where `returnNumber` is atomically generated using `NumberingService.nextNumber`.
4. Domain Events:
   Emits structured, tenant-scoped domain events (`RETURN_CREATED`, `RETURN_SUBMITTED`, `RETURN_AUTHORIZED`, `RETURN_RECEIVED`, `RETURN_CLOSED`, etc.) via `EventBusService`.

## Consequences

- Deterministic lifecycle progression across all return types (`CUSTOMER_RETURN`, `SUPPLIER_RETURN`, `INTERNAL_RETURN`, `WARRANTY_RETURN`, `REPLACEMENT_RETURN`).
- Strict auditability and tamper resistance on resolved and closed RMA records.
- Zero duplication of inventory balance tables by orchestrating warehouse location movements and M18/M15 financial engines.
