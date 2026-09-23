# M06 — Audit Logging & Internal Event Bus Architecture Guide

This document defines the application event bus architecture, centralized tenant-aware audit logging engine, recursive sensitive data sanitization, and tenant query APIs established in **Milestone M06**.

---

## 1. Architectural Overview & Event Flow

Milestone M06 decouples domain event publishing from audit persistence through an asynchronous, in-process event bus.

```
┌─────────────────────────────────────────────────────────────┐
│                       DOMAIN SERVICES                       │
│  • OrganizationsService, MembershipsService, RolesService   │
└──────────────────────────────┬──────────────────────────────┘
                               │ publish(event)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      EVENT BUS SERVICE                      │
│  • In-process EventBus delivering ApplicationEvent objects  │
│  • Parallel asynchronous execution with error isolation     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    AUDIT EVENT LISTENER                     │
│  • Subscribes to domain events (e.g. ROLE_CREATED)          │
│  • Bridges events with organizationId to AuditService       │
└──────────────────────────────┬──────────────────────────────┘
                               │ record(auditEvent)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUDIT SANITIZER SERVICE                   │
│  • Deep recursive redaction of sensitive credentials,       │
│    tokens, hashes, secrets, and authorization headers       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   POSTGRESQL AUDIT_LOGS                     │
│  • Immutable, append-only, tenant-scoped records            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Event Infrastructure

### 2.1 Contracts

```typescript
export interface ApplicationEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
}

export interface EventContext {
  readonly organizationId?: string;
  readonly actorUserId?: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}
```

### 2.2 EventBusService

- `subscribe(eventName, handler)`: Registers one or more handler callbacks.
- `publish(event)`: Executes handlers concurrently with error isolation.

---

## 3. Audit Logging Engine

### 3.1 Immutability & Append-Only Guarantees

- Audit records can only be created as side-effects of domain events.
- No REST API endpoints exist for creating (`POST`), modifying (`PATCH/PUT`), or deleting (`DELETE`) audit records.

### 3.2 Sensitive Data Redaction

`AuditSanitizerService` recursively redacts matching keys with `[REDACTED]`:

- Passwords (`password`, `passwordHash`, `password_hash`)
- Access & Refresh tokens (`accessToken`, `access_token`, `refreshToken`, `refresh_token`, `refreshTokenHash`, `refresh_token_hash`)
- Secrets & API Keys (`secret`, `clientSecret`, `client_secret`, `apiKey`, `api_key`, `token`)
- Network credentials (`authorization`, `cookie`)

---

## 4. Audit Query API

Base path: `/api/v1/audit-logs`

### Security Requirements

- `JwtAuthGuard` (Authenticated user)
- `TenantContextGuard` (Active organization member)
- `PermissionGuard` with `@RequirePermissions('audit.view')`

| Endpoint             | Method | Query Parameters                                                             | Description                                                  |
| :------------------- | :----- | :--------------------------------------------------------------------------- | :----------------------------------------------------------- |
| `/api/v1/audit-logs` | `GET`  | `page`, `limit` (max 100), `action`, `resource`, `actorUserId`, `from`, `to` | Lists tenant-scoped audit records sorted by `createdAt DESC` |

---

## 5. Security & Tenant Isolation Rules

1. **Automatic Tenant Scoping:** Queries always include `organization_id = currentTenant.organizationId`.
2. **Zero Secret Persistence:** Audit details are sanitized before persistence.
3. **No Stale Auth Claims:** All authorization checks use request-level tenant context and dynamic database permissions.
