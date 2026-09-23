# Integration Platform Security

## Security Architecture

The Integration Platform module (M39) implements multi-layered security controls to protect tenant boundaries and credentials.

### 1. SSRF Protection (SsrfGuardService)

Outbound webhook destinations are user-supplied URLs. To prevent Server-Side Request Forgery:

- Protocol must strictly be `https://`.
- Hostnames are resolved via DNS.
- Private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and IPv6 ULA/loopback (`fc00::/7`, `::1`) are rejected.
- Local hostnames (`localhost`, `0.0.0.0`) are blocked by name.

### 2. Credential Encryption (CredentialEncryptionService)

- Stored secrets are encrypted using AES-256-GCM.
- Per-record 12-byte random IV ensures unique ciphertexts for identical secrets.
- 16-byte authentication tag guarantees tamper detection.
- Secrets are decrypted only immediately before executing authenticated requests and are never included in API responses.

### 3. API Key Security (ApiKeysService)

- Cryptographically generated with 256 bits of entropy.
- Raw keys are returned exactly once upon creation and never stored.
- Database persists only the SHA-256 hash.
- Key prefix (8 chars) permits non-sensitive identification.

### 4. Audit & Observability

- All CRUD operations on connections, credentials, API keys, and webhooks record immutable audit events via `AuditService`.
- Structured logging redacts all tokens, secrets, and authorization headers via `StructuredLoggingService`.
