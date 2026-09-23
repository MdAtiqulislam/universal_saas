# ADR-102: Quotation Governance, Approval Gates & M28 Order Conversion

## Status

Accepted

## Context

Sales proposals require strict commercial governance prior to customer delivery, including formal internal approval, formal acceptance recording, and conversion to fulfillment orders without price drift.

## Decision

1. Enhance `Quotation` status lifecycle with explicit governance gates:
   `DRAFT` → `SUBMITTED` → `APPROVED` → `SENT` → `ACCEPTED` → `CONVERTED` (or `REJECTED` / `VOIDED`).
2. Mark Quotation immutable (`isImmutable: true`) upon `ACCEPTED` and `CONVERTED`.
3. Re-use M28 `SalesOrdersService.create` / `QuotationsService.convert` for authoritative 1-click conversion into Sales Orders.
4. Enforce invariant preventing double-conversion or price modification after proposal acceptance.

## Consequences

- Prevents unapproved quotes from reaching clients.
- Prevents post-acceptance tampering with negotiated prices or quantities.
- Guarantees seamless transition from CRM proposal to downstream supply chain execution.
