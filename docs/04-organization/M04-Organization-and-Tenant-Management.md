# M04 — Organization & Tenant Management Architecture Guide

This document defines the organization lifecycle, membership management, tenant-context resolution, multi-tenant switching, and security controls established in **Milestone M04**.

---

## 1. Architectural Scope & Tenant Boundaries

Milestone M04 answers: **"Which organization/tenant is this authenticated user operating in?"**  
It deliberately does **NOT** enforce RBAC permissions or business-domain logic (deferred to Milestone M05).

```
┌─────────────────────────────────────────────────────────────┐
│                 AUTHENTICATION LAYER (M03)                  │
│  • JWT Access Token verifies global identity (req.user.id)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               TENANT CONTEXT RESOLUTION (M04)               │
│  • Client supplies: X-Organization-Id: <uuid>               │
│  • TenantContextGuard validates active OrganizationMember   │
│  • Attaches req.tenantContext = { orgId, memberId, userId } │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                AUTHORIZATION & RBAC (M05)                   │
│  • Future Milestone: Evaluates roles & permissions          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Organization Lifecycle

### 2.1 Creation Transaction

Creating an organization (`POST /api/v1/organizations`) executes atomically inside a single PostgreSQL transaction:

1. Validates unique URL-safe `slug`.
2. Creates `Organization` record with `status: 'ACTIVE'`.
3. Creates default `OrganizationSetting` (`currency: 'USD'`, `timezone: 'UTC'`, `fiscalYearStart: 1`).
4. Creates initial `OrganizationMember` for the authenticated creator with `status: 'ACTIVE'`.
5. Finds system `OWNER` role (`organization_id IS NULL, is_system = true`) and assigns it via `MemberRole`.
6. If any step fails, the entire transaction rolls back.

### 2.2 Soft Deletion / Archiving

Deleting an organization (`DELETE /api/v1/organizations/:id`) performs a soft delete:

- Sets `status = 'ARCHIVED'` and `deletedAt = now()`.
- Historical data and audit trails are preserved.
- `TenantContextGuard` immediately blocks any subsequent access to archived organizations.

---

## 3. Membership Lifecycle & IDOR Protection

### 3.1 Membership States

- **`INVITED`**: Member has been invited by email. Cannot establish tenant context until active.
- **`ACTIVE`**: Full active member. Can establish tenant context.
- **`SUSPENDED`**: Member access disabled by organization. TenantContextGuard immediately rejects with `403 Forbidden`.

### 3.2 IDOR Defense in Membership Queries

All membership mutations (status updates, member removal) strictly scope database queries by both `(id: memberId, organizationId: orgId)`. Knowing a member UUID does not permit cross-tenant manipulation.

---

## 4. Tenant Context Guard & Header Resolution

`TenantContextGuard` is the canonical guard for tenant-scoped operations:

1. Checks authenticated request context (`req.user.id`).
2. Extracts and validates UUID from `X-Organization-Id`.
3. Validates `Organization` exists, `status === 'ACTIVE'`, and `deletedAt === null`.
4. Validates `OrganizationMember` exists for `(organizationId, userId)`, `status === 'ACTIVE'`, and `deletedAt === null`.
5. Attaches `TenantContext` to `req.tenantContext`.

```ts
export interface TenantContext {
  organizationId: string;
  membershipId: string;
  userId: string;
}
```

Accessible in controller handlers via `@CurrentTenant()`.

---

## 5. API Endpoints Specification

Base path: `/api/v1/organizations` (All endpoints require authentication)

| Endpoint                               | Method   | Path Parameters  | Request Body                                                | Description                                                    |
| :------------------------------------- | :------- | :--------------- | :---------------------------------------------------------- | :------------------------------------------------------------- |
| `/organizations`                       | `POST`   | None             | `{ name, slug }`                                            | Creates organization + settings + OWNER member (`201 Created`) |
| `/organizations`                       | `GET`    | None             | None                                                        | Lists user's active organizations (`200 OK`)                   |
| `/organizations/:id`                   | `GET`    | `id` (UUID)      | None                                                        | Retrieves organization details (`200 OK`)                      |
| `/organizations/:id`                   | `PATCH`  | `id` (UUID)      | `{ name?, slug? }`                                          | Updates organization profile (`200 OK`)                        |
| `/organizations/:id`                   | `DELETE` | `id` (UUID)      | None                                                        | Soft-deletes/archives organization (`200 OK`)                  |
| `/organizations/:id/members`           | `GET`    | `id` (UUID)      | None                                                        | Lists members in organization (`200 OK`)                       |
| `/organizations/:id/members`           | `POST`   | `id` (UUID)      | `{ email }`                                                 | Invites member to organization (`201 Created`)                 |
| `/organizations/:id/members/:memberId` | `PATCH`  | `id`, `memberId` | `{ status }`                                                | Updates member status (`200 OK`)                               |
| `/organizations/:id/members/:memberId` | `DELETE` | `id`, `memberId` | None                                                        | Soft-deletes member (`200 OK`)                                 |
| `/organizations/:id/settings`          | `GET`    | `id` (UUID)      | None                                                        | Retrieves organization settings (`200 OK`)                     |
| `/organizations/:id/settings`          | `PATCH`  | `id` (UUID)      | `{ currency?, timezone?, fiscalYearStart?, customFields? }` | Updates settings (`200 OK`)                                    |
