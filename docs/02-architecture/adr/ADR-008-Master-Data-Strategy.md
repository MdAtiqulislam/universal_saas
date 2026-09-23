# ADR-008: Master Data & Multi-Tenant Configuration Strategy

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Database Architect  
**Technical Milestone:** M07 — Master Data & Configuration Management

---

## Context & Problem Statement

Future business domain modules (Sales, Purchasing, Inventory, Accounting, CRM, Operations) require reusable, tenant-aware master data entities.

Key design questions:

1. Which master data entities are global platform reference data vs tenant-owned?
2. How should hierarchical locations be modeled without risking cross-tenant corruption or circular loops?
3. How should monetary tax rates be stored to prevent floating-point precision loss?

---

## Decision Drivers

1. **Global vs Tenant Boundary:** Avoid duplicating standard international definitions (ISO-4217 currencies) while strictly isolating tenant-specific configurations (branches, warehouses, tax rules, sequence counters).
2. **Hierarchy & Relational Integrity:** Locations must support nested parent-child trees (Head Office -> Branch -> Warehouse -> Section) while enforcing tenant isolation and self-parenting prevention.
3. **Financial Precision:** Tax rates must maintain decimal precision without IEEE-754 floating-point inaccuracies.
4. **Auditability & Soft Deletion:** Critical master data records must support soft deletion/archiving rather than destructive cascades.

---

## Decision Outcome

**Chosen Option:** **Two-Tier Master Data Architecture (Global Reference Data + Tenant-Scoped Configuration)**.

### Architectural Rules

1. **Global Reference Data (`currencies`):** Platform-level ISO-4217 currency definitions (`USD`, `EUR`, `BDT`, `INR`, `GBP`, etc.) shared across all tenants.
2. **Tenant-Scoped Entities (`locations`, `tax_rates`, `numbering_sequences`):**
   - Explicit non-null `organization_id` foreign key.
   - Unique constraints scoped per tenant (`UNIQUE(organization_id, code)`, `UNIQUE(organization_id, key)`).
   - Soft-deletion via `deleted_at` timestamp.
3. **Hierarchical Location Protection:**
   - Parent locations must belong to the same `organization_id`.
   - Self-parenting (`parentId === id`) is rejected.
   - Deleting a location with active children is blocked.
4. **High-Precision Tax Rates:** Stored using PostgreSQL `DECIMAL(12, 4)`.

### Positive Consequences

- Zero duplication of global ISO currencies.
- Strict cross-tenant isolation on all master data mutations and queries.
- Safe financial calculations with deterministic decimal precision.
