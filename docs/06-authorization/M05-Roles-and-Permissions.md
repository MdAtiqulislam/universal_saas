# M05 — Roles & Permissions (RBAC) Architecture Guide

This document defines the Role-Based Access Control (RBAC) architecture, permission evaluation engine, role management lifecycle, guard execution chain, and security controls established in **Milestone M05**.

---

## 1. Architectural Scope & Guard Execution Chain

Milestone M05 establishes the authorization foundation answering: **"What is this user allowed to do inside the current organization?"**

```
┌─────────────────────────────────────────────────────────────┐
│                 AUTHENTICATION LAYER (M03)                  │
│  • JwtAuthGuard verifies identity: req.user.id              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               TENANT CONTEXT RESOLUTION (M04)               │
│  • TenantContextGuard verifies membership & attaches:       │
│    req.tenantContext = { organizationId, membershipId }     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 RBAC AUTHORIZATION (M05)                    │
│  • PermissionGuard reads @RequirePermissions(...)           │
│  • AuthorizationService queries effective permissions for   │
│    (req.user.id, req.tenantContext.organizationId)          │
│  • AND semantics: User must possess ALL listed permissions  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Permission Model & System Roles

### 2.1 Core System Permissions

Permissions are global definitions structured as `resource.action`:

- `organizations.view`: View organization details and settings
- `organizations.manage`: Update organization settings and configuration
- `users.view`: List and view organization members
- `users.manage`: Invite, update, and suspend organization members
- `roles.view`: List available system and custom roles
- `roles.manage`: Create, update, and assign roles and permissions
- `audit.view`: Access immutable organization audit logs

### 2.2 Role Types

1. **Global System Roles (`organization_id IS NULL, is_system = true`)**:
   - `OWNER`: All permissions (`organizations.*`, `users.*`, `roles.*`, `audit.*`).
   - `ADMIN`: Operational management (`organizations.view`, `users.*`, `roles.*`, `audit.view`).
   - `VIEWER`: Read-only access (`organizations.view`, `users.view`, `roles.view`, `audit.view`).
   - _System roles are protected and cannot be modified, renamed, or deleted._
2. **Tenant Custom Roles (`organization_id = <uuid>, is_system = false`)**:
   - Custom roles created by organization administrators (e.g. `WAREHOUSE_MANAGER`, `ACCOUNTANT`).
   - Only accessible and assignable within the organization that created them.

---

## 3. Dynamic Permission Resolution & IDOR Defense

Permissions are dynamically resolved from the PostgreSQL database using:

```text
Current User (req.user.id)
       ↓
OrganizationMember (organization_id = req.tenantContext.organizationId)
       ↓
MemberRole (assigned roles)
       ↓
Role (Global system role OR Organization custom role)
       ↓
RolePermission
       ↓
Permission (resource.action)
```

### Cross-Tenant Protection

- Custom roles belonging to Organization A are strictly filtered out if evaluated in Organization B.
- Knowing a role UUID or member UUID from another organization cannot bypass tenant boundary.

---

## 4. Organization Owner Protection

The authorization engine guarantees that an organization can never be left without an active `OWNER`:

- Removing the `OWNER` role from the last active owner is rejected (`403 Forbidden`).
- Soft-deleting or suspending the last active `OWNER` member is rejected (`403 Forbidden`).

---

## 5. API Endpoints Specification

All endpoints require `JwtAuthGuard` + `TenantContextGuard` + `PermissionGuard`.

| Endpoint                                                    | Method   | Required Permission | Description                                                |
| :---------------------------------------------------------- | :------- | :------------------ | :--------------------------------------------------------- |
| `/api/v1/roles`                                             | `GET`    | `roles.view`        | Lists global system roles + tenant custom roles (`200 OK`) |
| `/api/v1/roles/:roleId`                                     | `GET`    | `roles.view`        | Retrieves role details and permissions (`200 OK`)          |
| `/api/v1/roles`                                             | `POST`   | `roles.manage`      | Creates a new tenant custom role (`201 Created`)           |
| `/api/v1/roles/:roleId`                                     | `PATCH`  | `roles.manage`      | Updates custom role name/description (`200 OK`)            |
| `/api/v1/roles/:roleId`                                     | `DELETE` | `roles.manage`      | Deletes unassigned custom role (`200 OK`)                  |
| `/api/v1/roles/:roleId/permissions`                         | `PUT`    | `roles.manage`      | Atomically replaces permissions for custom role (`200 OK`) |
| `/api/v1/organizations/:id/members/:memberId/roles`         | `GET`    | `roles.view`        | Lists roles assigned to a member (`200 OK`)                |
| `/api/v1/organizations/:id/members/:memberId/roles`         | `POST`   | `roles.manage`      | Assigns a role to a member (`201 Created`)                 |
| `/api/v1/organizations/:id/members/:memberId/roles/:roleId` | `DELETE` | `roles.manage`      | Removes a role from a member (`200 OK`)                    |
