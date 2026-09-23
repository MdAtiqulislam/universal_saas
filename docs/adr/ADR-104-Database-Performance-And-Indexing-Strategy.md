# ADR-104: Database Performance & Indexing Strategy

## Status

Accepted

## Context

As the Universal Business Operations SaaS platform scales across ERP, CRM, inventory, financial, and logistics operations, query contention and index scan efficiency become critical. Access patterns are strictly multi-tenant (`organizationId` + filter predicates).

## Decision

1. Add targeted composite indexes supporting common sorting and filtering paths:
   - `[organization_id, status, created_at]` on `sales_orders`, `customer_invoices`, `payments`, `return_requests`, `crm_leads`, `crm_opportunities`.
   - `[organization_id, idempotency_key]` unique composite index.
   - `[organization_id, job_type]` and `[organization_id, status]` on background jobs.
2. Require every new index to have an identified query shape and workload justification.
3. Reject unbounded table scans or queries without `organizationId` scoping.

## Consequences

- Index scans replace sequential scans for tenant-filtered listings and dashboard queries.
- Predictable query execution plans under high-volume multi-tenant data sets.
