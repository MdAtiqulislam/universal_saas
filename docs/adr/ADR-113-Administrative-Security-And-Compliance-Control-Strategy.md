# ADR-113: Administrative Security And Compliance Control Strategy

## Status

Accepted

## Context

Enterprise organizations require self-service administrative controls to configure authentication policies, view active device registries, enforce lockout parameters, inspect security incidents, and export compliance reports.

## Decision

1. **Configurable Tenant Security Policies**: Allow tenant administrators to configure maximum failed logins (1–20), lockout duration (1–1440 min), session lifetime (1–720 hrs), session idle timeout (5–1440 min), password complexity rules, and API rate limits via `SecurityPolicy`.
2. **10 Authoritative Compliance Reports**: Implement dedicated reporting engines for:
   - Authentication Activity
   - Failed Login & Brute Force Analysis
   - Active Session Registry
   - Privileged Actions
   - Authorization Failures & Access Denials
   - Tenant Security Events
   - API Rate Limit Violations
   - Suspicious & High-Risk Activity
   - Security Incident Timeline
   - Administrative Configuration Changes
3. **Dedicated Admin Security Console**: Provide a centralized frontend management dashboard at `/admin/security` (`apps/web/src/app/admin/security/page.tsx`).

## Consequences

### Positive

- Complete visibility and administrative autonomy for tenant administrators.
- Out-of-the-box compliance reporting for external audits.
- Centralized threat triage and session management.

### Negative

- Administrators must be granted explicit `security.*` permissions to access security endpoints.
