# Query Engine Specification

## Core Responsibilities

The `AnalyticsQueryEngineService` executes multi-tenant analytics queries with deterministic grouping, aggregations, and pagination.

## Query Pipeline

1. **Catalog Validation**: Resolves `definitionKey` from `AnalyticsDefinitionRegistry` (`INV-501`).
2. **Permission Check**: Verifies caller has required dataset permissions (`INV-502`, `INV-514`).
3. **Allowlist Enforcement**: Verifies requested dimensions and measures exist in definition catalog (`INV-502`).
4. **AST Compilation**: Validates Filter AST and translates to type-safe Prisma where clauses (`INV-503`, `INV-504`).
5. **Tenant Scoping**: Enforces `organizationId` predicate unconditionally (`INV-501`).
6. **Execution & Aggregation**: Fetches records and executes in-memory group-by and aggregation calculations (`INV-507`).
7. **Pagination & Bounds**: Clamps limit to 1000 and applies offset and deterministic sort order (`INV-505`).
8. **Telemetry Recording**: Emits structured execution metrics to `AnalyticsUsageRepository` (`INV-515`).
