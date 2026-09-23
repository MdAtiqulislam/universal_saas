# ADR-010: Product Catalog and Variant Architecture

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Product Architect  
**Technical Milestone:** M08 — Item & Product Catalog Management

---

## Context & Problem Statement

The platform requires a scalable and flexible product catalog foundation capable of supporting diverse business types (physical manufacturing, retail, professional services, digital products).

Core design decisions include:

1. How to structure hierarchical product taxonomies (Categories) within multi-tenant boundaries.
2. How to model products (Items) and their multidimensional variations (ItemVariants, such as size/color) without duplicating core item definitions.
3. How to decouple catalog master definitions from downstream inventory stock quantities, sales orders, and accounting ledger lines.

---

## Decision Drivers

1. **Multi-Tenancy Isolation:** Taxonomies, items, and variants must remain strictly scoped to the tenant (`organization_id`). Cross-tenant category parentage or item references must be forbidden.
2. **Hierarchy Safety:** Self-parenting loops and orphaned children must be prevented during updates and soft deletions.
3. **Extensibility & Schema Simplicity:** Support arbitrary variant attributes (e.g. `{ "size": "XL", "color": "Navy" }`) via JSONB while enforcing relational parent-child integrity between `Item` and `ItemVariant`.
4. **Boundary Isolation:** Keep stock balances, warehouse tracking, and transactions completely out of M08 catalog primitives.

---

## Decision Outcome

**Chosen Option:** **Two-Tier Item/Variant Model with Hierarchical Tenant-Scoped Taxonomies**.

### Core Architecture

1. **Hierarchical Categories (`categories`):**
   - Tenant-scoped with `parentId` self-referential foreign key (`onDelete: SetNull`).
   - Tenant code uniqueness (`UNIQUE(organization_id, code)`).
   - Service validation ensures `parentId !== id` and `parent.organizationId === organizationId`.
2. **Units of Measure (`units_of_measure`):**
   - Tenant-scoped units with code uppercase normalization and configurable decimal precision.
   - Deactivation preferred over destructive deletion.
3. **Item Master (`items`):**
   - Represents the canonical item definition with SKU uniqueness per tenant.
   - Typed by `ItemType` (`PRODUCT`, `SERVICE`, `DIGITAL`) and `TrackingType` (`NONE`, `BATCH`, `SERIAL`).
4. **Item Variants (`item_variants`):**
   - Specific sellable permutations linked to parent `Item`.
   - JSONB `attributes` column for flexible attribute storage.
   - Cascading soft deletion: archiving an item automatically archives its variants.

### Positive Consequences

- Clean separation between catalog master data and operational transactions.
- Flexible support for simple products, variant products, and non-inventory services.
- Strict multi-tenant isolation across all catalog resources.
