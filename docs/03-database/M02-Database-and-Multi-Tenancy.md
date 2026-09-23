# M02 — Database & Multi-Tenancy Architecture Guide

This document defines the PostgreSQL database architecture, Prisma ORM setup, core entity models, multi-tenancy design, indexing strategy, migration conventions, and seed workflows established in **Milestone M02**.

---

## 1. Database Architecture & Technology Stack

- **RDBMS Engine:** PostgreSQL 16 (Alpine in Docker)
- **Object-Relational Mapping (ORM):** Prisma ORM `v6.x`
- **Location:** `apps/api/prisma` ([ADR-001](file:///Users/revinr/Desktop/universal_saas/docs/02-architecture/adr/ADR-001-Prisma-Location.md))
- **Schema Mapping:** PascalCase model names in Prisma mapped to PostgreSQL `snake_case` tables and columns.
- **Timezone Standard:** UTC timestamps (`TIMESTAMPTZ(6)`).
- **Primary Key Standard:** UUID v4 (`@db.Uuid`, [ADR-002](file:///Users/revinr/Desktop/universal_saas/docs/02-architecture/adr/ADR-002-ID-Strategy.md)).

---

## 2. Multi-Tenancy & Identity Model

The platform enforces logical multi-tenancy through a 3-tier identity hierarchy ([ADR-003](file:///Users/revinr/Desktop/universal_saas/docs/02-architecture/adr/ADR-003-Multi-Tenancy-Strategy.md)):

```
┌─────────────────────────────────────────────────────────────┐
│                       GLOBAL MODELS                         │
│  • User (Global authentication identity)                    │
│  • Permission (Global platform action definitions)          │
│  • System Roles (Global roles where organization_id is NULL)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Linked via OrganizationMember
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    TENANT-SCOPED MODELS                     │
│  • Organization (The tenant boundary)                       │
│  • OrganizationSetting (Tenant settings & preferences)      │
│  • OrganizationMember (User membership in an organization)  │
│  • MemberRole (Role assignment to an OrganizationMember)    │
│  • Custom Roles (Tenant-specific roles where org_id != NULL)│
│  • AuditLog (Tenant-scoped immutable audit trail)           │
└─────────────────────────────────────────────────────────────┘
```

### Identity vs. Membership Rules

1. **`User` (Global Identity):** Represents an authentication account across the entire system. Emails are globally unique. Users have no direct tenant-scoped permissions outside an active membership.
2. **`Organization` (Tenant):** Represents an isolated customer boundary with a unique slug and lifecycle status.
3. **`OrganizationMember` (Tenant Access Boundary):** The junction entity linking a `User` to an `Organization`. A user can belong to multiple organizations with distinct statuses and assigned roles.

---

## 3. Schema & Entity Specifications

### Core Models Summary

| Table Name              | Model Type | Primary Key | Key Constraints & Indexes            | Description                                               |
| :---------------------- | :--------- | :---------- | :----------------------------------- | :-------------------------------------------------------- |
| `users`                 | Global     | UUID        | `UNIQUE(email)`                      | Global user credentials & authentication state            |
| `permissions`           | Global     | UUID        | `UNIQUE(name)`                       | Fine-grained system permissions (`resource.action`)       |
| `roles`                 | Hybrid     | UUID        | Partial unique on `name`             | Global system roles or tenant-specific custom roles       |
| `role_permissions`      | Hybrid     | UUID        | `UNIQUE(role_id, permission_id)`     | Associative mapping between roles and permissions         |
| `organizations`         | Tenant     | UUID        | `UNIQUE(slug)`                       | Tenant customer boundary                                  |
| `organization_settings` | Tenant     | UUID        | `UNIQUE(organization_id)`            | 1-to-1 tenant settings, currency, timezone, custom fields |
| `organization_members`  | Tenant     | UUID        | `UNIQUE(organization_id, user_id)`   | Tenant access boundary linking user to organization       |
| `member_roles`          | Tenant     | UUID        | `UNIQUE(member_id, role_id)`         | Roles assigned to specific organization members           |
| `audit_logs`            | Tenant     | UUID        | `INDEX(organization_id, created_at)` | Immutable tenant-scoped audit logging trail               |

### Role Uniqueness Strategy

To avoid reliance on SQL NULL behavior, role uniqueness is enforced via dual PostgreSQL partial unique indexes:

1. **Global System Roles (`organization_id IS NULL`):**
   ```sql
   CREATE UNIQUE INDEX "roles_system_name_unique" ON "roles"("name") WHERE "organization_id" IS NULL;
   ```
2. **Tenant-Scoped Roles (`organization_id IS NOT NULL`):**
   ```sql
   CREATE UNIQUE INDEX "roles_org_name_unique" ON "roles"("organization_id", "name") WHERE "organization_id" IS NOT NULL;
   ```

---

## 4. Referential Integrity & Deletion Rules

| Parent Entity          | Child Entity            | Foreign Key Constraint | Delete Behavior | Rationale                                                   |
| :--------------------- | :---------------------- | :--------------------- | :-------------- | :---------------------------------------------------------- |
| `organizations`        | `organization_settings` | `organization_id`      | `CASCADE`       | Settings belong exclusively to the organization             |
| `organizations`        | `organization_members`  | `organization_id`      | `CASCADE`       | Organization deletion purges memberships                    |
| `users`                | `organization_members`  | `user_id`              | `CASCADE`       | User deletion purges membership links                       |
| `organization_members` | `member_roles`          | `member_id`            | `CASCADE`       | Membership deletion purges assigned role links              |
| `roles`                | `member_roles`          | `role_id`              | `RESTRICT`      | Cannot delete a role currently assigned to active members   |
| `roles`                | `role_permissions`      | `role_id`              | `CASCADE`       | Role deletion purges permission mappings                    |
| `permissions`          | `role_permissions`      | `permission_id`        | `CASCADE`       | Permission deletion cleans up mappings                      |
| `organizations`        | `audit_logs`            | `organization_id`      | `CASCADE`       | Audit logs belong to organization lifecycle                 |
| `users`                | `audit_logs`            | `actor_user_id`        | `SET NULL`      | Preserves audit trail even if actor user account is deleted |

---

## 5. Soft-Delete Semantics (Documented Intent)

Soft-delete is modeled via nullable `deleted_at TIMESTAMPTZ(6)` columns:

- **`users.deleted_at`:** User account deactivated; login is rejected while preserving historical authored records and audit trail integrity.
- **`organizations.deleted_at`:** Entire tenant suspended/archived; access blocked for all organization members.
- **`organization_members.deleted_at`:** User membership revoked in a specific tenant without affecting their memberships in other tenants.

_Note: Application-level query filtering for soft deletion will be implemented in subsequent business milestones._

---

## 6. Local Database Setup & Migrations

### Local Database Startup

```bash
# Start PostgreSQL (and Redis) containers
pnpm docker:up
```

### Migration Commands

```bash
# Validate Prisma schema
pnpm db:validate

# Generate Prisma Client
pnpm db:generate

# Apply migrations in development
pnpm db:migrate
```

### Deterministic Development Seed

```bash
# Execute deterministic development seed
pnpm db:seed
```

#### Seeded Development Fixtures

- **Organization:** `Acme Operations Ltd` (slug: `acme-dev`, currency: `USD`, timezone: `UTC`)
- **Admin User:** `admin@example.com`
- **Dev Password:** `Admin123!DevPasswordOnly` (Argon2id hashed, strictly for development)
- **Role Assigned:** `OWNER` (full system permissions)

---

## 7. NestJS Prisma Service Integration

The database connection is managed via `PrismaService` in `apps/api/src/prisma/prisma.service.ts`:

- Implements `OnModuleInit` to connect on startup.
- Implements `OnModuleDestroy` for graceful disconnect during server shutdown.
- Exported globally by `PrismaModule` (`@Global()`) for seamless dependency injection across future modules.
