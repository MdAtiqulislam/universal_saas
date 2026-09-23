# 09 - Security, Tenant Isolation & Governance

## Core Security Invariants

The Developer Platform enforces multi-layered defense-in-depth across the API consumption lifecycle:

### 1. Invariable Tenant Isolation

- Every API key is strictly tied to a single `organizationId`.
- Incoming requests can never access or modify data belonging to another tenant.
- If a request supplies a header or query parameter attempting to impersonate another organization (e.g. `X-Organization-Id: <different-uuid>`), `ApiKeyAuthGuard` immediately rejects the request with HTTP 403 and records a security incident via `SecurityEventsService.logEvent`.

### 2. Zero-Exposure Key Material

- Only the 64-character SHA-256 hash of API keys is stored in the database.
- Telemetry logs (`ApiUsageRecord`), structured application logs, and exception filters never log raw API keys, bearer tokens, or sensitive authorization headers.

### 3. Rate Limiting Defense

- Key-authenticated endpoints are guarded by M37 `RateLimitingService`.
- Rate limit violations return standard HTTP 429 Too Many Requests with `Retry-After` headers and record security telemetry.

### 4. Zero Arbitrary URL Invocation (SSRF)

- The API Explorer only executes routes defined in the internal `ApiContractService` catalog.
- Execution occurs strictly against internal application endpoints without outbound internet routing.

### 5. Auditing & Compliance

- Security-sensitive actions (API key generation, rotation, revocation, and telemetry export) write immutable audit records via `AuditService.record()`.
