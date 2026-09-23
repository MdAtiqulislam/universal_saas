# ADR-004: Request-Level Tenant Context Resolution & Header Validation

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Security Architect  
**Technical Milestone:** M04 — Organization & Tenant Management

---

## Context & Problem Statement

The platform is a multi-tenant SaaS where a global `User` can be an active member of multiple `Organization` tenants simultaneously.

A design decision was required on how incoming HTTP API requests specify and establish the authoritative tenant context (`TenantContext`):

- **Option A:** Embed `organizationId` inside the JWT access token claims.
- **Option B:** Store a mutable `current_organization_id` on the database `User` record.
- **Option C:** Supply an explicit header (`X-Organization-Id: <uuid>`) per request and validate it against the authenticated user's active `OrganizationMember` record in PostgreSQL.

---

## Decision Drivers

1. **Multi-Organization Coexistence & Instant Switching:** Users switching between multiple organizations must not require refreshing/reissuing JWT tokens or mutating database user state.
2. **Revocation & Stale Claims Prevention:** Access tokens must remain tenant-neutral. If a user's membership in Organization A is suspended or revoked, an existing JWT must not grant continued access.
3. **Defense-in-Depth against IDOR:** Client-supplied organization IDs must never be trusted without active membership validation in PostgreSQL.
4. **Separation of Concerns:**
   - **Authentication (M03):** Answers _"Who is this user?"_
   - **Tenant Resolution (M04):** Answers _"Which organization is this user operating in?"_
   - **Authorization (M05):** Answers _"What is this user allowed to do inside that organization?"_

---

## Decision Outcome

**Chosen Option:** **Option C (`X-Organization-Id` header validated per request against active `OrganizationMember`)**.

### Architectural Rules

1. **Tenant-Neutral JWT:** The JWT payload MUST remain strictly `{ sub, sid, iat, exp }`. Zero organization or role data is embedded in JWT tokens.
2. **Canonical Header:** Tenant-scoped operations accept `X-Organization-Id: <uuid>` as the canonical header input.
3. **Authoritative Membership Validation (`TenantContextGuard`):**
   ```text
   Organization.exists (deletedAt IS NULL, status === ACTIVE)
   AND
   OrganizationMember.exists (userId === req.user.id, organizationId === headerOrgId, deletedAt IS NULL, status === ACTIVE)
   ```
4. **Invalid Access Rejection:** Any failure in membership or organization status strictly returns `403 Forbidden` or `400/404` where appropriate.
5. **Context Attachment:** `TenantContextGuard` attaches `{ organizationId, membershipId, userId }` to `req.tenantContext`, accessible via `@CurrentTenant()`.

### Positive Consequences

- Instantaneous organization switching without token reissuance.
- Immediate enforcement if a membership or organization is suspended/archived.
- Elimination of stale tenant claims inside access tokens.
- Cross-tenant IDOR vulnerabilities are prevented by query-level scoping `(id: memberId, organizationId: orgId)`.

### Negative Consequences / Trade-offs

- Each tenant-scoped request performs a fast indexed lookup of `OrganizationMember` (optimized by `UNIQUE(organization_id, user_id)`).
