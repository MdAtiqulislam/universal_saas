# ADR-094: Service Management and Installed Base Architecture

## Status

Accepted

## Context

As part of Milestone M34, the Universal Business Operations SaaS platform requires a production-grade after-sales service and customer equipment registry architecture. Customers purchase equipment and products that require tracking across serial numbers, warranty terms, maintenance intervals, field dispatches, and diagnostic repair histories. This installed base must remain strictly distinct from company-owned internal fixed assets (managed under M22).

## Decision

1. Introduce `CustomerAsset` as the central aggregate for customer-owned equipment, linking `customerId`, `itemId`, optional `variantId`, and `serialId` / `serialNumber`.
2. Maintain installed asset service lifecycle (`OPERATIONAL`, `UNDER_SERVICE`, `DECOMMISSIONED`, `SCRAPPED`).
3. Enforce strict multi-tenant scoping on all assets (`@@unique([organizationId, assetNumber])`).
4. Establish unified service history aggregation consolidating service requests, support tickets, technician assignments, diagnoses, estimates, service orders, parts issuances, and handover receipts.

## Consequences

### Positive

- Full visibility into installed base lifecycle and maintenance history.
- Clean separation between tenant internal assets (M22) and customer equipment.
- Immediate traceability from sales orders/deliveries to after-sales service.

### Negative

- Requires maintaining dual tracking when items are both serialized inventory and customer assets post-delivery.
