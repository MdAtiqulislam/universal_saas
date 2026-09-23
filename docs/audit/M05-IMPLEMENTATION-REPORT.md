# Milestone M05 — Implementation Report: Roles & Permissions (RBAC)

**Milestone**: M05 — Roles & Permissions (RBAC)  
**Status**: **COMPLETED**  
**Date**: August 28, 2026  
**Auditor**: Antigravity Technical Pair Programmer

---

## 1. Executive Summary

Milestone M05 establishes a production-grade, tenant-aware Role-Based Access Control (RBAC) foundation for the **Universal Business Operations SaaS** platform.

All requirements, including `@RequirePermissions` decorator, `AuthorizationService`, `PermissionGuard`, `RolesModule`, custom role CRUD, transactional role permission replacement, scoped member role assignment, Owner protection, and extensive unit/isolation test suites have been implemented and verified.

Zero business domain logic or static JWT permission claims were introduced, preserving architectural boundaries.

---

## 2. Files Created & Modified

| File                                                              | Status   | Description                                                                           |
| :---------------------------------------------------------------- | :------- | :------------------------------------------------------------------------------------ |
| `apps/api/src/auth/decorators/require-permissions.decorator.ts`   | NEW      | `@RequirePermissions()` decorator setting route metadata                              |
| `apps/api/src/auth/authorization.service.ts`                      | NEW      | Dynamic permission evaluation engine with AND semantics                               |
| `apps/api/src/auth/guards/permission.guard.ts`                    | NEW      | Guard resolving permissions against tenant context                                    |
| `apps/api/src/auth/auth.module.ts`                                | MODIFIED | Exported `AuthorizationService` and `PermissionGuard`                                 |
| `apps/api/src/organizations/memberships.service.ts`               | MODIFIED | Added Owner protection against removing/suspending last OWNER                         |
| `apps/api/src/roles/dto/create-role.dto.ts`                       | NEW      | DTO with name normalization, length checks, permissions                               |
| `apps/api/src/roles/dto/update-role.dto.ts`                       | NEW      | DTO for optional name and description updates                                         |
| `apps/api/src/roles/dto/update-role-permissions.dto.ts`           | NEW      | DTO for atomic permission updates                                                     |
| `apps/api/src/roles/dto/assign-role.dto.ts`                       | NEW      | DTO for member role assignment with UUID validation                                   |
| `apps/api/src/roles/roles.service.ts`                             | NEW      | Role listing, custom role CRUD, permissions update, member role assignment            |
| `apps/api/src/roles/roles.controller.ts`                          | NEW      | REST endpoints for role catalog and member roles guarded by RBAC                      |
| `apps/api/src/roles/roles.module.ts`                              | NEW      | NestJS module exporting `RolesService`                                                |
| `apps/api/src/app.module.ts`                                      | MODIFIED | Imported `RolesModule`                                                                |
| `apps/api/src/auth/authorization.service.spec.ts`                 | NEW      | Unit tests covering single/multiple roles, inactive memberships, cross-tenant defense |
| `apps/api/src/auth/guards/permission.guard.spec.ts`               | NEW      | Unit tests covering missing context, permission granted, 403 denied                   |
| `apps/api/src/roles/roles.service.spec.ts`                        | NEW      | Unit tests covering custom role lifecycle, system role protection, OWNER protection   |
| `apps/api/src/roles/tenant-rbac-isolation.spec.ts`                | NEW      | Tests covering cross-tenant RBAC isolation scenarios                                  |
| `apps/api/src/organizations/memberships.service.spec.ts`          | MODIFIED | Updated mock for `memberRole`                                                         |
| `docs/02-architecture/adr/ADR-005-RBAC-Authorization-Strategy.md` | NEW      | ADR on permission-based dynamic RBAC                                                  |
| `docs/06-authorization/M05-Roles-and-Permissions.md`              | NEW      | Complete M05 RBAC architecture guide                                                  |
| `docs/audit/M05-IMPLEMENTATION-REPORT.md`                         | NEW      | Milestone M05 implementation report                                                   |

---

## 3. Database & Migrations

- **Database State:** Verified against M02 schema. The existing models (`Role`, `Permission`, `RolePermission`, `MemberRole`, `OrganizationMember`, `Organization`) and partial unique indexes completely satisfy M05 requirements.
- **Migration Result:** Zero additional database migrations were necessary, keeping historical migrations intact.

---

## 4. Security & RBAC Controls

1. **Deny-by-Default:** Routes requiring permissions strictly reject missing, empty, or unmapped permissions with `403 Forbidden`.
2. **Dynamic Request-Level Resolution:** Evaluated per request using `(req.user.id, req.tenantContext.organizationId)`. Eliminates stale permission windows.
3. **No Sensitive Claims in JWT:** Access tokens remain strictly tenant-neutral `{ sub, sid, iat, exp }`.
4. **Owner Protection:** Verified at service level that an organization cannot be left without an active `OWNER`.
5. **System Role Immutability:** Global system roles (`OWNER`, `ADMIN`, `VIEWER`) cannot be deleted, modified, or hijacked by tenant users.
6. **Cross-Tenant Isolation:** Custom roles from Organization A cannot authorize users in Organization B.

---

## 5. Verification & Test Results

| Check / Command     | Exit Code | Result | Details                                                      |
| :------------------ | :-------- | :----- | :----------------------------------------------------------- |
| `pnpm db:validate`  | 0         | PASSED | Prisma schema validated                                      |
| `pnpm db:generate`  | 0         | PASSED | Typed Prisma Client generated                                |
| `pnpm format:check` | 0         | PASSED | 100% Prettier compliance                                     |
| `pnpm lint`         | 0         | PASSED | 0 ESLint warnings and 0 errors across workspace              |
| `pnpm typecheck`    | 0         | PASSED | Strict TypeScript checks passed across all apps and packages |
| `pnpm test`         | 0         | PASSED | 100 tests passed across 14 test suites                       |
| `pnpm build`        | 0         | PASSED | NestJS API and Next.js Web production bundles built cleanly  |

---

## 6. Known Limitations & Technical Debt

- **Granular Permission Inheritance/Hierarchy:** M05 evaluates exact flat permission matches (`resource.action`) with AND semantics. If hierarchical wildcard expansion (e.g. `users.*`) is required later, it can be added to `AuthorizationService`.
- **UI RBAC Integration:** Front-end role and permission management screens will be connected during the business UI milestone.

---

## 7. Recommended Next Milestone

Proceed to **Milestone M06 — Next Domain Foundation / Audit Logging & System Event Bus**.
