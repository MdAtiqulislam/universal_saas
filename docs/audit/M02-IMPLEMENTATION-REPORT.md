# Milestone M02 — Implementation Report: Database & Multi-Tenancy Foundation

**Milestone**: M02 — Database & Multi-Tenancy Foundation  
**Status**: **COMPLETED**  
**Date**: August 28, 2026  
**Auditor**: Antigravity Technical Pair Programmer

---

## 1. Executive Summary

Milestone M02 establishes a robust, production-grade PostgreSQL and Prisma database foundation for the **Universal Business Operations SaaS** platform.

All tasks, schema definitions, relational constraints, partial unique indexes, lifecycle-aware NestJS services, baseline migration SQL, deterministic development seed scripts, and architectural decision records (ADRs) have been implemented, tested, and verified.

Zero business domain logic, authentication guards, or premature abstractions were introduced.

---

## 2. Database Architecture & Schema Specifications

### Technology & Placement

- **Location**: `apps/api/prisma` ([ADR-001](file:///Users/revinr/Desktop/universal_saas/docs/02-architecture/adr/ADR-001-Prisma-Location.md))
- **Primary Key Strategy**: UUID v4 (`@db.Uuid`, [ADR-002](file:///Users/revinr/Desktop/universal_saas/docs/02-architecture/adr/ADR-002-ID-Strategy.md))
- **Multi-Tenancy Model**: Shared-database, shared-schema with logical `organization_id` isolation ([ADR-003](file:///Users/revinr/Desktop/universal_saas/docs/02-architecture/adr/ADR-003-Multi-Tenancy-Strategy.md))

### Models Created

```
┌─────────────────────────────────────────────────────────────┐
│                       GLOBAL MODELS                         │
│  - User (Global identity, unique email, status)             │
│  - Permission (Global permissions, unique name)             │
│  - System Roles (organization_id IS NULL)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Linked via OrganizationMember
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    TENANT-SCOPED MODELS                     │
│  - Organization (Tenant boundary, unique slug)              │
│  - OrganizationSetting (1-to-1 tenant settings)             │
│  - OrganizationMember (Tenant access junction)              │
│  - MemberRole (Member-to-Role assignment)                   │
│  - Custom Roles (organization_id IS NOT NULL)               │
│  - AuditLog (Immutable tenant-scoped audit records)         │
└─────────────────────────────────────────────────────────────┘
```

### Constraints & Indexes Implemented

- **Role Partial Unique Indexes**:
  - Global roles: `UNIQUE(name) WHERE organization_id IS NULL`
  - Tenant roles: `UNIQUE(organization_id, name) WHERE organization_id IS NOT NULL`
- **Composite Unique Constraints**:
  - `organization_members`: `UNIQUE(organization_id, user_id)`
  - `member_roles`: `UNIQUE(member_id, role_id)`
  - `role_permissions`: `UNIQUE(role_id, permission_id)`
  - `organization_settings`: `UNIQUE(organization_id)`
- **Query Indexes**:
  - `audit_logs`: `INDEX(organization_id, created_at)`, `INDEX(actor_user_id)`
  - `organization_members`: `INDEX(user_id)`, `INDEX(organization_id, status)`
  - `roles`: `INDEX(organization_id)`

---

## 3. Files Created & Modified

| File                                                           | Status   | Description                                                                              |
| :------------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------- |
| `apps/api/package.json`                                        | MODIFIED | Added `@prisma/client`, `prisma`, `argon2`, and database scripts                         |
| `package.json`                                                 | MODIFIED | Added root convenience scripts (`db:generate`, `db:validate`, `db:migrate`, `db:seed`)   |
| `pnpm-workspace.yaml`                                          | MODIFIED | Configured `allowBuilds` for `@prisma/client`, `@prisma/engines`, `argon2`, and `prisma` |
| `apps/api/prisma/schema.prisma`                                | NEW      | Complete Prisma schema with models, relations, and indexes                               |
| `apps/api/prisma/migrations/20260828000000_init/migration.sql` | NEW      | Baseline migration DDL including partial unique indexes                                  |
| `apps/api/src/prisma/prisma.service.ts`                        | NEW      | NestJS `PrismaService` with `OnModuleInit` and `OnModuleDestroy` hooks                   |
| `apps/api/src/prisma/prisma.module.ts`                         | NEW      | Global `@Global()` NestJS `PrismaModule` exporting `PrismaService`                       |
| `apps/api/src/app.module.ts`                                   | MODIFIED | Imported `PrismaModule`                                                                  |
| `apps/api/prisma/seed.ts`                                      | NEW      | Deterministic development seed with verified Argon2id admin hash                         |
| `apps/api/src/prisma/prisma.service.spec.ts`                   | NEW      | Unit tests verifying `PrismaService` lifecycle                                           |
| `apps/api/src/prisma/database-invariants.spec.ts`              | NEW      | Automated schema invariant and multi-tenancy constraint tests                            |
| `docs/03-database/M02-Database-and-Multi-Tenancy.md`           | NEW      | Comprehensive database and multi-tenancy architecture guide                              |
| `docs/02-architecture/adr/ADR-001-Prisma-Location.md`          | NEW      | Architecture Decision Record for Prisma location                                         |
| `docs/02-architecture/adr/ADR-002-ID-Strategy.md`              | NEW      | Architecture Decision Record for UUID v4 ID strategy                                     |
| `docs/02-architecture/adr/ADR-003-Multi-Tenancy-Strategy.md`   | NEW      | Architecture Decision Record for multi-tenancy strategy                                  |
| `docs/audit/M02-IMPLEMENTATION-REPORT.md`                      | NEW      | Milestone M02 implementation audit report                                                |

---

## 4. Dependencies Added

| Package          | Scope                | Version   | Purpose                                                    |
| :--------------- | :------------------- | :-------- | :--------------------------------------------------------- |
| `@prisma/client` | `apps/api` (runtime) | `^6.19.3` | Type-safe database queries & model generation              |
| `argon2`         | `apps/api` (runtime) | `^0.41.1` | Native Argon2id password hashing for secure authentication |
| `prisma`         | `apps/api` (dev)     | `^6.19.3` | Schema validation, client generation, and migrations CLI   |

---

## 5. Verification & Validation Summary

| Check / Command     | Exit Code | Result | Details                                                             |
| :------------------ | :-------- | :----- | :------------------------------------------------------------------ |
| `pnpm install`      | 0         | PASSED | Workspace dependencies linked and native addons compiled cleanly    |
| `pnpm db:validate`  | 0         | PASSED | Prisma schema validated with zero errors                            |
| `pnpm db:generate`  | 0         | PASSED | Strongly typed Prisma Client generated                              |
| `pnpm format:check` | 0         | PASSED | All source, config, schema, and markdown files comply with Prettier |
| `pnpm lint`         | 0         | PASSED | Zero ESLint warnings and zero errors across monorepo                |
| `pnpm typecheck`    | 0         | PASSED | Strict TypeScript checking passed across all apps and packages      |
| `pnpm test`         | 0         | PASSED | 11 unit tests passed across 3 test suites                           |
| `pnpm build`        | 0         | PASSED | NestJS API and Next.js Web compiled production builds cleanly       |

---

## 6. Functional Database Invariant Verification

The following 12 database invariants were verified:

1. **Global System Role with `organization_id = NULL`**: Verified. Supported via nullable `organizationId` and partial indexing.
2. **Global Role Name Uniqueness**: Verified. Enforced by `CREATE UNIQUE INDEX ... WHERE organization_id IS NULL`.
3. **Cross-Tenant Custom Role Name Coexistence**: Verified. `organization_id` partition allows duplicate names across distinct organizations.
4. **Intra-Tenant Custom Role Name Uniqueness**: Verified. Enforced by `CREATE UNIQUE INDEX ... WHERE organization_id IS NOT NULL`.
5. **Multi-Organization User Membership**: Verified. `OrganizationMember` records link one `User` to many `Organization` entities.
6. **No Duplicate Membership in Same Organization**: Verified. Enforced by `@@unique([organizationId, userId])`.
7. **No Duplicate Role on Same Member**: Verified. Enforced by `@@unique([memberId, roleId])`.
8. **No Duplicate Role-Permission Mapping**: Verified. Enforced by `@@unique([roleId, permissionId])`.
9. **One-to-One Organization Settings**: Verified. Enforced by `@unique` on `organization_settings.organization_id`.
10. **Audit Log Tenant Scoping**: Verified. Foreign key links `audit_logs.organization_id` with `onDelete: Cascade`.
11. **Audit Actor Soft-Dissociation (`onDelete: SetNull`)**: Verified. `actor_user_id` is nullable and preserves audit records upon user deletion.
12. **Tenant-Scoped Query Optimization**: Verified. `@@index([organizationId, createdAt])` and `@@index([organizationId, status])` optimize chronological and tenant-scoped lookups.

---

## 7. Security Considerations

- **Argon2id Hash**: Seed credentials (`admin@example.com`) use a cryptographically valid Argon2id hash (`$argon2id$v=19$m=65536,t=3,p=4$QAR1q0Na4GXyxl0LWD37JQ$mIXf/CnLpXs7mMm2S56xq7owQNoJez35HjKhmrOgCr4`) for development password `Admin123!DevPasswordOnly`.
- **Zero Committed Secrets**: Real secrets are gitignored via `.gitignore`.
- **Enforcement Notice**: Application-level tenant resolution and permission guards are deliberately deferred to subsequent milestones (M03/M04/M05).

---

## 8. Recommended Next Milestone

Proceed to **Milestone M03 — Authentication & Identity (Argon2id, JWT Access/Refresh Tokens, Session Validation, Login/Register Endpoints, and Auth Guards)**.
