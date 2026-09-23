# ADR-120: API Key Security Design

**Status:** Accepted  
**Date:** 2026-09-02  
**Milestone:** M39

## Context

External API consumers need programmatic access to the platform without interactive session-based authentication. API keys must be cryptographically secure, auditable, and revocable. Plaintext API keys must never be persisted in databases or logs.

## Decision

1. **SHA-256 only storage (INV-354)**: Raw API keys are generated once using `crypto.randomBytes(32)` (256-bit entropy) and returned to the caller exactly once upon creation. Only the SHA-256 hash is persisted in the database. The raw key is NEVER logged or saved.
2. **Key prefix**: The first 8 characters of the raw key are stored as `keyPrefix` to allow tenants to identify keys in the UI without exposing the full key or hash.
3. **Granular scopes**: Each API key carries a list of scope strings matching permission names. External API consumers may only execute actions permitted by their declared scopes.
4. **Expiry and rotation**: Keys support optional expiry dates. Expired keys cannot authenticate.
5. **Soft revocation**: Keys are revoked by recording `revokedAt` and `revokedReason`. Revoked keys are permanently invalidated.

## Consequences

- Lost raw keys cannot be recovered by administrators or users — new keys must be generated.
- Key validation performs an indexed SHA-256 hash lookup (`sha256Hash`).
- All key generation, usage, and revocation operations produce immutable audit records.
