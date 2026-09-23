# ADR-059: Manufacturing and BOM Architecture

## Status

Accepted

## Context

Universal Business Operations SaaS requires an authoritative, multi-tenant manufacturing foundation (Milestone M25) capable of managing Bill of Materials (BOM) recipes, multi-level component trees, scrap percentages, effective dates, and production orders. To preserve manufacturing and financial integrity, circular BOM graphs must be strictly forbidden, and historical BOM recipes referenced by active or completed production orders must remain immutable.

## Decision

1. **Multi-Tenant BOM Domain Model**:
   - Model `BillOfMaterial` as a tenant-scoped header aggregate with `itemId`, `variantId`, `quantity`, `uomId`, `version`, and lifecycle statuses (`DRAFT`, `ACTIVE`, `INACTIVE`, `OBSOLETE`, `ARCHIVED`).
   - Model `BillOfMaterialLine` as itemized component recipes specifying `quantity`, `scrapPercentage`, and `lineNumber`.
2. **Circular Reference Prevention**:
   - Direct self-reference check: Component `itemId` cannot match the finished product `itemId`.
   - Recursive graph traversal check: Dynamically traverse all sub-BOMs in the tenant organization to detect and reject indirect cycles.
3. **BOM Immutability & Versioning**:
   - Once a BOM is referenced by active (`RELEASED`, `IN_PROGRESS`, `PARTIALLY_COMPLETED`) or closed production orders, direct edits are blocked. Engineers must create a new version instead.

## Consequences

- Guarantees deterministic BOM explosion and planning calculations.
- Protects historical manufacturing and costing traceability against post-facto modifications.
