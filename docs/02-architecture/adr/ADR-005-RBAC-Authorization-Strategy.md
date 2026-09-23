# ADR-005: Permission-Based Tenant-Aware RBAC Authorization Strategy

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Security Architect  
**Technical Milestone:** M05 — Roles & Permissions (RBAC)

---

## Context & Problem Statement

The platform is a multi-tenant SaaS that requires a granular, scalable, and secure access control architecture.

We evaluated different authorization strategies:

1. **Role-Name Checking in Controllers (`if (user.role === 'ADMIN')`):** Hardcoded checks on role strings.
2. **Static JWT Role/Permission Claims:** Embedding roles or permissions directly inside JWT payloads.
3. **Dynamic Permission-Based RBAC with Request-Level Tenant Resolution:** Granular permissions (`resource.action`) resolved per request against the PostgreSQL database using `(userId, organizationId)`.

---

## Decision Drivers

1. **Custom Tenant Roles:** Organizations must be allowed to define and customize roles (`ACCOUNTANT`, `WAREHOUSE_MANAGER`, `INVENTORY_AUDITOR`) with custom sets of permissions without altering application code or controller guards.
2. **Deny by Default:** Unmapped routes or missing permissions must immediately return `403 Forbidden`.
3. **No Stale Claims / Instant Revocation:** If a user's role is removed or a custom role's permissions are updated, the changes must take effect immediately without requiring users to log out and obtain a new JWT token.
4. **Cross-Tenant Authorization Isolation:** A role granted to a user in Organization A must NEVER confer permissions when the user accesses Organization B.

---

## Decision Outcome

**Chosen Option:** **Option 3 (Dynamic Permission-Based RBAC evaluated per request)**.

### Architectural Rules

1. **Guards Execution Chain:**
   ```text
   JwtAuthGuard (Who is the user?)
         ↓
   TenantContextGuard (Which organization are they accessing?)
         ↓
   PermissionGuard (Is the user permitted to perform this action in this organization?)
   ```
2. **Granular Permission Naming:** Permissions follow `resource.action` (e.g. `users.view`, `users.manage`, `roles.view`, `roles.manage`, `organizations.manage`, `audit.view`).
3. **AND Semantics:** Route declarations using `@RequirePermissions('users.view', 'users.manage')` require that the user holds **all** listed permissions.
4. **System Role Protection:** Global system roles (`OWNER`, `ADMIN`, `VIEWER` where `organization_id IS NULL, is_system = true`) are platform-wide immutable templates that cannot be renamed, modified, or deleted by tenant users.
5. **Organization Owner Protection:** An organization can never be left without an active `OWNER`. Operations that attempt to remove or suspend the last active OWNER are strictly rejected with `403 Forbidden`.

### Positive Consequences

- Zero stale permission windows.
- Decoupled business controllers from role names.
- Complete cross-tenant authorization isolation.
- Seamless support for custom tenant roles.
