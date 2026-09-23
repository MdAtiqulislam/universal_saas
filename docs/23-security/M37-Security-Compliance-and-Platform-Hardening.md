# M37 — Security, Compliance & Platform Hardening Specification

## 1. Executive Summary

Milestone M37 establishes a unified, multi-tenant **Security, Compliance & Platform Hardening** layer across the Universal Business Operations SaaS platform. M37 fortifies authentication against brute-force attacks with progressive throttling and account lockouts; secures multi-device sessions with cryptographic rotation, activity tracking, and instant global revocation; prevents API volumetric abuse via sliding-window rate limiting; centralizes categorized security audit event logging with deep redaction of sensitive credentials; and delivers an administrative security console and 10 compliance reports.

---

## 2. Architectural Pillars

```text
+-----------------------------------------------------------------------------------+
|                           M37 Security & Compliance Layer                         |
+-----------------------------------------------------------------------------------+
|  1. Authentication Hardening                                                      |
|     - Login attempt tracking (login_attempts table)                               |
|     - Progressive delay & automated account lockout (default 5 fails = 15m lock)  |
|     - Explicit administrative account unlocking                                   |
+-----------------------------------------------------------------------------------+
|  2. Session & Token Lifecycle                                                     |
|     - 320-bit SHA-256 hashed refresh tokens & replay invalidation                 |
|     - Multi-device registry, activity timestamps, and idle timeout (60m)          |
|     - Single session revocation & tenant-wide / user-wide global logout           |
+-----------------------------------------------------------------------------------+
|  3. Rate Limiting & Abuse Prevention                                              |
|     - Sliding-window in-memory rate limiter partitioned by tenant and key         |
|     - Configurable quotas (default 120 req/min/tenant)                            |
|     - API_ABUSE security event alerting on threshold breach                       |
+-----------------------------------------------------------------------------------+
|  4. Immutable Security Audit Repository                                           |
|     - 10 Threat Categories (AUTH, AUTHZ, SESSION, TENANT, ABUSE, etc.)            |
|     - 5 Severity Levels (INFO, LOW, MEDIUM, HIGH, CRITICAL)                       |
|     - Recursive sanitization redacting passwords, tokens, API keys, and PII       |
+-----------------------------------------------------------------------------------+
|  5. Administrative Governance & 10 Compliance Reports                             |
|     - Configurable tenant security policy parameters                              |
|     - Frontend console at /admin/security with 10 authoritative compliance feeds  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Database Models

### `LoginAttempt`

Tracks all authentication attempts for brute-force and credential stuffing analysis.

- `id`: UUID (Primary Key)
- `email`: VARCHAR(255)
- `organizationId`: UUID (Nullable)
- `userId`: UUID (Nullable)
- `ipAddress`: TEXT (Nullable)
- `userAgent`: TEXT (Nullable)
- `status`: VARCHAR(50) (`SUCCESS`, `FAILED`, `LOCKED`, `BLOCKED`)
- `failureReason`: TEXT (Nullable)
- `createdAt`: TIMESTAMPTZ(6)

### `SecurityEvent`

Append-only immutable security event repository.

- `id`: UUID (Primary Key)
- `organizationId`: UUID (Nullable)
- `category`: VARCHAR(50) (`AUTHENTICATION`, `AUTHORIZATION`, `SESSION`, `TENANT_SECURITY`, `API_ABUSE`, `DATA_ACCESS`, `ADMINISTRATION`, `CONFIGURATION`, `INTEGRATION`, `SYSTEM_SECURITY`)
- `eventType`: VARCHAR(100)
- `severity`: VARCHAR(20) (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `actorUserId`: UUID (Nullable)
- `ipAddress`: TEXT (Nullable)
- `userAgent`: TEXT (Nullable)
- `resource`: VARCHAR(100) (Nullable)
- `resourceId`: VARCHAR(100) (Nullable)
- `details`: JSONB (Sanitized)
- `createdAt`: TIMESTAMPTZ(6)

### `SecurityPolicy`

Tenant-scoped configurable security settings.

- `id`: UUID (Primary Key)
- `organizationId`: UUID (Unique)
- `maxFailedLogins`: INT (Default: 5)
- `lockoutDurationMinutes`: INT (Default: 15)
- `sessionLifetimeHours`: INT (Default: 24)
- `sessionIdleTimeoutMinutes`: INT (Default: 60)
- `passwordMinLength`: INT (Default: 12)
- `passwordRequireUppercase`: BOOLEAN (Default: true)
- `passwordRequireNumbers`: BOOLEAN (Default: true)
- `passwordRequireSymbols`: BOOLEAN (Default: true)
- `passwordHistoryRetention`: INT (Default: 5)
- `apiRateLimitPerMinute`: INT (Default: 120)
- `mfaEnforced`: BOOLEAN (Default: false)

---

## 4. 10 Authoritative Compliance Reports

1. **Authentication Activity Report**: Login volumes, success vs. failure ratios.
2. **Failed Login & Brute Force Report**: Targeted email and attacking IP hotspot aggregation.
3. **Active Session Report**: Live connected devices and tokens per tenant.
4. **Privileged Action Report**: System administration and configuration changes.
5. **Authorization Failure Report**: Access denials, permission violations, and boundary checks.
6. **Tenant Security Events Report**: Categorized threat breakdowns across organizations.
7. **API Rate Limit Violation Report**: Throttling thresholds and burst attempts.
8. **Suspicious Activity Report**: High and critical severity incidents.
9. **Security Incident Timeline**: Chronological forensic audit log.
10. **Administrative Change Report**: Tenant policy alterations and role modifications.

---

## 5. Security & Isolation Invariants (301–325)

Invariants 301–325 enforce strict multi-tenant isolation, account lockout determinism, session revocation permanence, rate limit key partitioning, zero plaintext logging, and tamper-proof security event logging.
