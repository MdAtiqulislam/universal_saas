# ADR-144: PostgreSQL-First Unified Search Architecture and Modular Domain Providers

**Status:** Accepted  
**Date:** 2026-09-11  
**Milestone:** M44

## Context

The Universal SaaS platform spans 11+ operational domains (CRM, Sales, Inventory, Warehouse, Quality, Returns, Service, Finance, Workflows, Notifications, Users). Users need unified discovery without knowing which database table or module owns the record. Introducing an external search cluster (Elasticsearch, OpenSearch) introduces high operational overhead, cluster synchronization delays, eventual consistency challenges, cross-tenant leak vectors, and high hosting costs.

## Decision

1. **PostgreSQL-First Unified Architecture (`INV-476`, `INV-477`)**:
   - Standardize on PostgreSQL capabilities, utilizing B-tree and text indexes, multi-tenant scoped filtering, and deterministic ranking without external search clusters.
   - Maintain global authoritative search definitions in `SearchDefinition` to specify searchable fields, filterable fields, and required permissions per domain.
2. **Domain-Specific Search Provider Abstraction (`INV-478`, `INV-479`)**:
   - Implement the `SearchProvider` interface across 11 domain adapters: `CustomerSearchProvider`, `SalesSearchProvider`, `InventorySearchProvider`, `WarehouseSearchProvider`, `QualitySearchProvider`, `ReturnsSearchProvider`, `ServiceSearchProvider`, `FinanceSearchProvider`, `WorkflowSearchProvider`, `NotificationSearchProvider`, and `UserSearchProvider`.
   - Each provider strictly enforces `organizationId` at the database query boundary (`INV-478`) and requires specific RBAC permissions (`INV-479`) before returning any records.
3. **Bounded Concurrency Orchestration**:
   - The central `UnifiedSearchService` fans out across authorized domain providers using `boundedParallel` (`concurrency = 5`) to ensure database connection pools are never overwhelmed during global queries.

## Consequences

- Zero external infrastructure dependencies; single source of truth within PostgreSQL.
- True multi-tenant isolation and strict permission gating before any record data leaves provider boundaries.
- Seamless horizontal expansion: new business domains register a `SearchProvider` with `UnifiedSearchService` with zero changes to the query or ranking pipelines.
