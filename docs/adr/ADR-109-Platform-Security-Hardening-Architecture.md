# ADR-109: Platform Security Hardening Architecture

## Status

Accepted

## Context

As the Universal Business Operations SaaS platform handles mission-critical ERP, accounting, supply chain, CRM, and transactional operations across multiple tenants, it requires an enterprise-grade platform security hardening architecture. Prior milestones established foundational authentication (M03), RBAC (M04/M05), and audit logging (M06). M37 provides centralized, hardened security controls without duplicating domain logic or compromising multi-tenant boundaries.

## Decision

1. **Layered Defense-in-Depth**: Implement security hardening across Authentication, Session & Token Lifecycle, API Rate Limiting, Audit Telemetry, and Tenant Security Policies.
2. **Deterministic Account Lockout**: Enforce progressive authentication throttling and automated account lockouts after configurable consecutive failed attempts (default 5 failures = 15 minute lockout).
3. **Zero Secret Logging**: Ensure all security telemetry and audit events pass through recursive sanitization redacting passwords, hashes, JWTs, API keys, and credentials.
4. **Append-Only Security Audit Engine**: Store all authentication, authorization, session, and administrative security events in an immutable, tenant-scoped audit table (`security_events`).

## Consequences

### Positive

- Prevents credential stuffing, brute-force attacks, and session hijack attempts.
- Provides full regulatory and compliance traceability with zero credential leakage.
- Preserves complete multi-tenant isolation and strict RBAC enforcement.

### Negative

- Additional write operations for authentication attempt tracking and security event logging.
