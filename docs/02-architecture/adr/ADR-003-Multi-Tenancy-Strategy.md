# ADR-003: Multi-Tenancy Architecture & Isolation Strategy

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Security Architect, Database Architect  
**Technical Milestone:** M02 — Database & Multi-Tenancy Foundation

---

## Context & Problem Statement

The platform is a multi-tenant business operations SaaS supporting multiple organizations. An architectural strategy is required for multi-tenant data partitioning and security isolation.

Evaluated Isolation Strategies:

1. **Database-per-tenant:** Separate PostgreSQL database for each customer organization.
2. **Schema-per-tenant:** Shared database with separate PostgreSQL schemas (`CREATE SCHEMA tenant_xxx`).
3. **Shared-database, shared-schema (Application-level logical isolation with `organization_id`):** Single schema where all tenant-owned tables include a foreign key reference to `organizations.id`.

---

## Decision Drivers

1. **Operational Simplicity & Migration Agility:** Running migrations across thousands of distinct schemas or databases adds immense operational latency and complexity.
2. **Resource Efficiency & Cost:** Shared database and shared schema maximizes connection pool utilization and minimizes infrastructure costs.
3. **Cross-Tenant User Model:** Users must be able to log in with a single global identity and belong to multiple organizations via `OrganizationMember`.
4. **Defense-in-Depth:** Application-level scoping with future support for PostgreSQL Row-Level Security (RLS) policies.

---

## Decision Outcome

**Chosen Option:** **Shared-database, shared-schema with logical `organization_id` foreign keys and composite indexing**.

### Architectural Invariants

1. **Identity vs Tenancy:**
   - `User` = Global authentication identity.
   - `Organization` = Tenant boundary.
   - `OrganizationMember` = Tenant membership and authorization boundary.
2. **Tenant Scoping Rule:** Every tenant-owned table MUST include `organization_id UUID NOT NULL` referencing `organizations(id)` with `onDelete: Cascade`.
3. **Global Models Exemption:** Platform-wide reference data (e.g. `permissions`, system `roles` where `organization_id IS NULL`) are global and not partitioned by tenant.
4. **Indexing Rule:** Tenant-scoped queries MUST be supported by composite indexes on `(organization_id, created_at)` or specific query filters to ensure performant execution plans.
5. **Enforcement Scope:** Milestone M02 establishes the relational database structure, foreign keys, and indexes. Application-level tenant resolution and automated WHERE-clause filtering are enforced in subsequent application milestones (M04).

### Positive Consequences

- Streamlined migration workflow with single-schema migrations.
- High connection pool efficiency and lower infrastructure operational costs.
- Clean support for multi-organization user memberships.
