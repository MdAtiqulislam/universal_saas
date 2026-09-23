# ADR-070: Sales Order Lifecycle and Approval Strategy

## Status

Accepted

## Context

In an enterprise Order-to-Cash workflow, customer sales orders progress through distinct operational stages. Prior to inventory allocation or fulfillment, commercial terms must be validated, including customer account active status, valid line pricing, non-zero quantities, and customer credit limits.

## Decision

1. Implement formal state machine: `DRAFT -> SUBMITTED -> APPROVED -> ALLOCATED -> PARTIALLY_FULFILLED -> FULFILLED -> CLOSED` (with `CANCELLED`, `REJECTED`, `VOIDED`).
2. Require approval verification:
   - Tenant isolation verification (`organizationId`).
   - Customer exists, is active, and is not soft-deleted.
   - At least one valid order line exists with quantity > 0.
   - Total outstanding unpaid customer invoices + new order total must not exceed customer `creditLimit` (when configured).
3. Record approval audit metadata: `approvedByUserId`, `approvedAt`, `rejectedByUserId`, `rejectedAt`, `rejectionReason`.

## Consequences

- Guaranteed commercial compliance before stock reservation or warehouse execution.
- Full auditability of approval decisions.
