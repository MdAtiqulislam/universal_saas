# ADR-107: Caching & Background Processing Strategy

## Status

Accepted

## Context

Long-running workloads (MRP calculations, large financial period close reconciliations, heavy analytical reports) and frequent static configuration lookups (tax rates, warranty policies, numbering rules) require dedicated performance strategies without compromising transactional isolation.

## Decision

1. **Caching**:
   - Multi-tenant cache key structure: `tenant:{organizationId}:{namespace}:{key}`.
   - Restrict caching strictly to configuration, RBAC, and static master data.
   - Forbid caching mutable transactional state (inventory balances, GL account balances, active invoices).
   - Invalidate tenant namespaces on configuration mutation.
2. **Background Processing**:
   - `JobService` backed by `background_jobs` table with tenant propagation and progress tracking.
   - Bounded worker pool processing pending jobs asynchronously.
   - Support for job cancellation, failure tracking, and status retrieval.

## Consequences

- Prevents HTTP request timeouts for heavy computational tasks.
- Eliminates redundant database roundtrips for static enterprise configuration.
