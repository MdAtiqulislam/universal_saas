# ADR-115: Structured Logging, Correlation, and Error Strategy

**Status:** Accepted  
**Date:** 2026-08-31  
**Milestone:** M38

## Context

Scattered Logger.log() calls provide no structured context for operational investigation. No request correlation mechanism exists for tracing requests across service boundaries.

## Decision

### Structured Logging via StructuredLoggingService

Every log entry carries: timestamp, level, service, module, environment, requestId, correlationId, organizationId, userId, route, method, statusCode, durationMs, event, errorCode.

Sensitive field redaction reuses AuditSanitizerService (M06). Log levels: TRACE, DEBUG, INFO, WARN, ERROR, FATAL. Production defaults to INFO+.

### Request Correlation (INV-326, INV-327)

AsyncLocalStorage provides request-scoped context. RequestLoggingInterceptor:

1. Generates requestId (crypto.randomUUID())
2. Sets X-Request-Id response header
3. Runs CorrelationContextService.run() wrapping handler chain
4. Logs structured request/response entry

AsyncLocalStorage guarantees context isolation per async call chain — no cross-request leakage (INV-327).

### Error Taxonomy and Fingerprinting

13 canonical error categories (INV-328). Error fingerprint = SHA-256(module + errorCode + sanitizedStackTop3Lines) — deterministic and secret-free (INV-329, INV-330). Production responses never include stack traces.

## Consequences

- Consistent structured logs enable grep/search-based investigation.
- X-Request-Id enables end-to-end tracing.
- ~0.5ms overhead per request from AsyncLocalStorage (acceptable).
- Existing Logger.log() calls remain unchanged — additive only.
