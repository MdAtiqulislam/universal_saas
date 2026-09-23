# ADR-075: Shipment Lifecycle and Tracking Strategy

## Status

Accepted

## Context

Transport logistics involves multiple stages: preparation, carrier assignment, physical dispatch, transit updates, and delivery confirmation. Exceptional scenarios (failed attempts, customer returns, early cancellations) must be handled deterministically.

## Decision

1. Define a 10-state lifecycle enum: `DRAFT`, `READY`, `ASSIGNED`, `DISPATCHED`, `IN_TRANSIT`, `DELIVERED`, `FAILED`, `RETURNED`, `CANCELLED`, `CLOSED`.
2. Transition validation is enforced within transactional boundaries (`dispatch`, `deliver`, `fail`, `return`, `cancel`, `close`).
3. Maintain an append-only, chronological `ShipmentTrackingEvent` ledger recording status changes, locations, timestamps, and audit actors.

## Consequences

- Impossible to skip mandatory logistics states or perform invalid mutations.
- Full auditability for end-to-end customer tracking timelines.
