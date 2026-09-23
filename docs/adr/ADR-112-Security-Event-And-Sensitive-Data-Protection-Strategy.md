# ADR-112: Security Event And Sensitive Data Protection Strategy

## Status

Accepted

## Context

Compliance standards (SOC2, ISO 27001, GDPR) require comprehensive security event logging, tamper-resistant audit trails, and strict prohibition of plaintext credential or PII logging.

## Decision

1. **Categorized Security Event Repository**: Structure security telemetry into 10 explicit threat categories: `AUTHENTICATION`, `AUTHORIZATION`, `SESSION`, `TENANT_SECURITY`, `API_ABUSE`, `DATA_ACCESS`, `ADMINISTRATION`, `CONFIGURATION`, `INTEGRATION`, `SYSTEM_SECURITY`.
2. **Standardized Severity Levels**: Classify all events into `INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
3. **Mandatory Deep Redaction**: All security event payloads pass through `AuditSanitizerService` to strip and replace sensitive keys (`password`, `password_hash`, `access_token`, `refresh_token`, `apiKey`, `secret`, `cookie`, `national_id`, `salary`) with `[REDACTED]`.
4. **Append-Only Immutability**: Security events are immutable once committed and strictly indexed by `[organization_id, category, created_at]`.

## Consequences

### Positive

- Fully compliant, audit-ready security telemetry.
- Zero risk of plaintext credential leakage into application logs or audit storage.
- Rapid forensic querying across threat categories and severity levels.

### Negative

- Sanitization traversal incurs minor CPU overhead on complex nested payload objects.
