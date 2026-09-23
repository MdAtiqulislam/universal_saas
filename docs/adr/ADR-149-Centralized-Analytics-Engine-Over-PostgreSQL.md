# ADR-149: Centralized Analytics Engine Over PostgreSQL

## Status

Accepted

## Context

As the SaaS platform evolved across CRM, Sales, Inventory, Warehouse, Quality, Returns, Service, Finance, Workflows, Notifications, and Developer domains, operational users required multi-dimensional business intelligence, aggregate metrics, and trends without deploying a separate external data warehouse (e.g., ClickHouse, Snowflake, or Elasticsearch).

Deploying external OLAP clusters introduces substantial deployment complexity, dual-write consistency hazards, network latency, high infrastructure costs, and complex tenant isolation management.

## Decision

We implement a **PostgreSQL-First Centralized Analytics Engine** (`AnalyticsQueryEngineService`) directly integrated into NestJS.

1. **One Analytics Engine -> Many Domain Reports**: A single core engine compiles, validates, scopes, and aggregates queries across 12 domain datasets.
2. **Authoritative Dataset Catalog**: An in-code registry defines allowed dimensions, allowed measures, supported aggregations (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`), allowed filter fields, and required RBAC permissions.
3. **Strict Tenancy Scoping**: Every query is strictly locked to `organizationId`, preventing any cross-tenant data access.
4. **Deterministic In-Memory Aggregation**: Safe parameterized queries fetch tenant-isolated row slices up to bounded limits, and deterministic grouping and aggregations compute results in sub-100ms latency.

## Consequences

### Positive

- Zero external infrastructure dependency; 100% standard PostgreSQL and Node.js runtime.
- Built-in multi-tenant isolation and role-based access control.
- Sub-50ms execution latency for standard operational dataset slices.
- Consistent metadata catalog shared between backend validation, frontend visual explorer, and public APIs.

### Negative / Mitigations

- Heavy queries with millions of unindexed rows could cause high memory usage; mitigated by strict row limit bounds (take 5000 max), AST complexity limits, and query timeouts.

## Related Invariants

- `INV-501`: Centralized Authoritative Dataset Registry
- `INV-502`: Domain Metric & Dimension Allowlisting
- `INV-503`: Zero Dynamic / Raw SQL Interpolation
