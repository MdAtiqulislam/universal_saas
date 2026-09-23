# ADR-001: Prisma ORM Location within Monorepo

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Database Architect  
**Technical Milestone:** M02 — Database & Multi-Tenancy Foundation

---

## Context & Problem Statement

The Universal Business Operations SaaS project is structured as a pnpm workspaces monorepo containing:

- Backend application: `apps/api` (NestJS)
- Frontend application: `apps/web` (Next.js)
- Shared packages: `packages/config`, `packages/types`, `packages/ui`

A architectural decision was required on where to locate the Prisma schema, generated client, migration files, and database seed scripts:

- **Option A:** Co-locate inside `apps/api/prisma`.
- **Option B:** Create a dedicated shared package `packages/database`.

---

## Decision Drivers

1. **Monolith Architectural Pattern:** The system is explicitly designed as a Modular Monolith with an API-first REST gateway (`apps/api`).
2. **Access Boundaries:** The frontend (`apps/web`) communicates strictly via HTTP REST endpoints (`/api/v1`) and never interacts with the database directly.
3. **Complexity & Maintenance Overhead:** Creating a separate `packages/database` package introduces additional build artifacts, type synchronization steps, and potential version drift between the client generator and NestJS dependency injection.
4. **Avoid Premature Abstraction:** Project guidelines mandate avoiding unnecessary abstractions until a concrete architectural need arises.

---

## Considered Options

- **Option A:** Co-locate Prisma in `apps/api/prisma`.
- **Option B:** Separate package in `packages/database`.

---

## Decision Outcome

**Chosen Option:** **Option A (`apps/api/prisma`)**.

### Positive Consequences

- NestJS `PrismaService` and `PrismaModule` seamlessly import `@prisma/client` without intermediate package compilation.
- Migrations, schema, seed scripts, and NestJS modules reside in a cohesive backend service boundary.
- Zero extra monorepo linking or multi-stage build overhead.

### Negative Consequences / Trade-offs

- If standalone microservices or CLI tools outside `apps/api` require direct database access in the future, Prisma can be extracted to `packages/database` without altering the schema or database migrations.
