# ADR-002: Primary Key & Entity Identifier Strategy

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Database Architect  
**Technical Milestone:** M02 — Database & Multi-Tenancy Foundation

---

## Context & Problem Statement

The platform requires a standardized, robust, and secure primary key strategy across all database models in PostgreSQL.

Primary key identifier strategies evaluated:

1. **Auto-incrementing Integers (`SERIAL` / `BIGSERIAL`)**
2. **Universally Unique Identifiers (UUID v4)**
3. **Collision-resistant Unique Identifiers (CUID / CUID2)**

---

## Decision Drivers

1. **Multi-Tenancy Security:** Auto-incrementing integers expose sequential entity counts and allow ID-enumeration / guessing attacks across tenants.
2. **Distributed Systems & Data Migration:** Importing historical legacy records (e.g. from Visual FoxPro) and generating IDs on client/worker nodes requires decentralized generation without database round-trips.
3. **Database Native Support:** PostgreSQL provides native, high-performance 128-bit `UUID` data types with indexing support.
4. **Prisma & Tooling Standardization:** Prisma supports `@default(uuid()) @db.Uuid` out-of-the-box.

---

## Decision Outcome

**Chosen Option:** **UUID v4 (`@id @default(uuid()) @db.Uuid`)**.

### Specific Rules

- All database tables MUST use UUID v4 as their primary key `id`.
- Foreign key columns MUST use UUID types (`@db.Uuid`).
- Sequential integer IDs are strictly prohibited for entity primary keys. (Human-readable sequential document numbers, such as Invoice numbers or Purchase Order numbers, will be stored in separate dedicated business columns).

### Positive Consequences

- Non-enumerable, secure IDs preventing cross-tenant information disclosure.
- Safe client-side or worker-side pre-generation of IDs.
- Native storage efficiency in PostgreSQL (`16 bytes` per UUID).

### Negative Consequences / Trade-offs

- UUIDs are slightly larger than 4-byte integers in B-tree index nodes; mitigated by proper composite indexing on tenant query patterns.
