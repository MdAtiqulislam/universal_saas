# ADR-006: Centralized Tenant-Scoped Append-Only Audit Logging Strategy

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Security Architect  
**Technical Milestone:** M06 — Audit Logging & System Event Bus Foundation

---

## Context & Problem Statement

Compliance, security observability, and regulatory standards require an immutable audit trail of critical tenant operations across the platform.

Key design questions:

1. Should audit logs be stored in dedicated per-tenant databases/tables or a centralized relational model?
2. Should generic audit write/update/delete APIs be exposed?
3. How should global non-tenant authentication events be handled?

---

## Decision Drivers

1. **Immutability & Append-Only Storage:** Audit records must never be modified or deleted by application users or administrators.
2. **Tenant Scoping & Strict Query Isolation:** Every audit query must be filtered by `organization_id`. Cross-tenant data leakage is strictly prohibited.
3. **Data Sanitization:** Passwords, tokens, keys, and authorization cookies must never enter audit logs.
4. **Schema Reusability:** Reuse the existing M02 `AuditLog` table without introducing redundant migrations or schema churn.

---

## Decision Outcome

**Chosen Option:** **Centralized Tenant-Scoped Append-Only AuditLog with Recursive Sanitization**.

### Architectural Rules

1. **Append-Only Immutability:** Audit records are inserted strictly via application domain events through `AuditService.record()`. No REST API endpoints exist for creating (`POST`), updating (`PATCH/PUT`), or deleting (`DELETE`) audit logs.
2. **Mandatory Tenant Scoping:** Every audit log record requires a valid non-null `organizationId`. Audit queries (`GET /api/v1/audit-logs`) automatically enforce `organizationId = currentTenant.organizationId`.
3. **Recursive Sensitive-Data Redaction:** `AuditSanitizerService` recursively redacts credentials, hashes, access/refresh tokens, API keys, and authorization cookies with `[REDACTED]` before database insertion.
4. **Authentication Event Boundary:** Global authentication events without an explicit organization context (e.g. initial registration, login attempts before tenant selection) are published to the event bus but are not inserted into the tenant-scoped `audit_logs` table.

### Positive Consequences

- Zero audit log tampering.
- Complete regulatory audit trail per tenant.
- Zero secret leakage in database or log exports.
- Reuse of existing indexed `AuditLog` model with zero database migrations.
