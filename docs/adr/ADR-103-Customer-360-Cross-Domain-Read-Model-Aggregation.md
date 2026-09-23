# ADR-103: Customer 360 Cross-Domain Read-Model Aggregation

## Status

Accepted

## Context

Sales and account managers need unified visibility into an account's complete lifecycle across presales, sales orders, invoices, payments, deliveries, installed assets, service tickets, and quality issues.

## Decision

1. Implement `CrmCustomer360Service` as a composite read-model aggregation layer.
2. Query authoritative tables concurrently via `Promise.all`:
   - M11 `Customer`, `CustomerContact`
   - M35 `Lead`, `Opportunity`, `CrmActivity`
   - M28 `Quotation`, `SalesOrder`
   - M14 `CustomerInvoice`
   - M15 `Payment`
   - M29 `Shipment`
   - M32 `ReturnRequest`
   - M34 `CustomerAsset`, `ServiceTicket`, `ServiceOrder`
   - M31 `CustomerQualityIssue`
3. Compute customer lifetime value (LTV), outstanding AR balance, active pipeline, and total installed equipment count on-the-fly without data duplication.

## Consequences

- Single pane of glass for all customer touchpoints and operational activity.
- Zero data duplication across domain boundaries.
- Guaranteed real-time consistency with authoritative downstream ledgers and order books.
