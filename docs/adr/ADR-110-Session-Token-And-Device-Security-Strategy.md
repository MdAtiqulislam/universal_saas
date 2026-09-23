# ADR-110: Session Token And Device Security Strategy

## Status

Accepted

## Context

Multi-device SaaS access requires robust session management, token rotation, and rapid revocation capabilities to prevent compromised device sessions from accessing confidential tenant data.

## Decision

1. **Cryptographic Refresh Token Rotation**: Refresh tokens are stored strictly as SHA-256 hashes in `sessions` with 320-bit entropy raw tokens issued to clients. Replay attempts trigger immediate session invalidation.
2. **Individual & Global Session Revocation**: Administrators and users can revoke individual device sessions or trigger global logout across all active sessions (`LOGOUT_ALL_DEVICES`).
3. **Session Activity & Idle Expiration**: Track `last_activity_at` on every session to enforce configurable idle timeout windows (default 60 minutes) alongside absolute expiration (default 24 hours).
4. **Tenant Isolation on Sessions**: Session queries and revocation controls strictly verify organization membership boundaries.

## Consequences

### Positive

- Prevents session hijacking and token reuse attacks.
- Enables instant tenant-wide or user-wide remediation during credential compromise incidents.
- Clear visibility into live device sessions across organizations.

### Negative

- Requires periodic session cleanup for expired records.
