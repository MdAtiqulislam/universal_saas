# DOC-24-04: Error Taxonomy & Classification Catalog

**Milestone:** M38 — Platform Observability, Reliability & Operational Excellence Foundation  
**Status:** APPROVED  
**Classification:** Standard Reference Catalog

---

## 1. Canonical Error Categories (INV-328)

| Category           | Typical Status Code | Severity | Description                                                                    |
| :----------------- | :------------------ | :------- | :----------------------------------------------------------------------------- |
| `VALIDATION`       | 400 Bad Request     | LOW      | Malformed request body, constraint violation, missing parameters.              |
| `AUTHENTICATION`   | 401 Unauthorized    | MEDIUM   | Expired JWT, invalid password, missing Authorization header.                   |
| `AUTHORIZATION`    | 403 Forbidden       | MEDIUM   | Insufficient RBAC permissions, crossed tenant boundaries.                      |
| `NOT_FOUND`        | 404 Not Found       | LOW      | Target entity does not exist in tenant domain.                                 |
| `CONFLICT`         | 409 Conflict        | LOW      | Unique index collision, duplicate sequence number, concurrency lock collision. |
| `BUSINESS_RULE`    | 422 Unprocessable   | MEDIUM   | Domain rule broken (e.g., posting to closed accounting period).                |
| `CONCURRENCY`      | 409 / 500           | HIGH     | Optimistic locking violation, deadlocked concurrent database transactions.     |
| `DATABASE`         | 500 Internal Error  | HIGH     | Prisma client connection failure, query timeout, pool exhaustion.              |
| `EXTERNAL_SERVICE` | 502 / 504           | MEDIUM   | Upstream API timeout (e.g., payment gateway, tax engine, email provider).      |
| `BACKGROUND_JOB`   | 500 Internal Error  | MEDIUM   | Asynchronous worker process execution failure.                                 |
| `SECURITY`         | 403 / 429           | CRITICAL | Rate limit breach, brute-force attack detected, session hijacking attempt.     |
| `INTERNAL`         | 500 Internal Error  | MEDIUM   | Unhandled runtime exception or unexpected coding defect.                       |

---

## 2. Fingerprinting & Sanitization (INV-329, INV-330)

### 2.1 Deterministic Error Fingerprinting

```typescript
fingerprint = SHA256(module + ":" + errorCode + ":" + sanitizedStackLines.slice(0, 3).join("|"));
```

- File system paths and tenant UUIDs are stripped before hashing.
- Identical crash sites produce identical `stackHash` values, enabling automatic deduplication and trend grouping.

### 2.2 Public Safe Error Response (INV-340)

Production error responses never reveal raw stack traces or internal schema details:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "errorCode": "PRISMA_TIMEOUT",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-08-31T12:00:00.000Z"
}
```
