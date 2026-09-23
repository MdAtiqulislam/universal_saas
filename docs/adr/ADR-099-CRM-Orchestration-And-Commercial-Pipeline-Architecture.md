# ADR-099: CRM Orchestration & Commercial Pipeline Architecture

## Status

Accepted

## Context

Universal SaaS requires a commercial sales pipeline covering the entire lifecycle from early prospect outreach to authoritative order fulfillment. Prior milestones (M11, M14, M15, M28, M29, M30, M31, M32, M34) established authoritative engines for master data, sales order processing, billing, inventory, service, and quality. M35 must not duplicate existing entities or logic, but orchestrate commercial intake and pipeline visibility.

## Decision

1. Implement M35 as an orchestration and read layer managing `Lead`, `Opportunity`, `OpportunityLine`, and `CrmActivity` models.
2. Re-use existing `Customer` and `CustomerContact` from M11/M23 as the single source of truth for accounts.
3. Re-use existing `Quotation` from M28, adding approval gates and links to opportunities and contacts.
4. Delegate order fulfillment strictly to M28 `SalesOrdersService`.

## Consequences

- Clean separation between presales/CRM interactions and authoritative fulfillment engines.
- Zero duplication of customer profiles, pricing rules, tax engines, or ledger postings.
- Full auditability across commercial milestones.
