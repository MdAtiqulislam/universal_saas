# 02 — Search Engine Guide

## Search Orchestration Lifecycle

1. **Request Intake & Validation**:
   - The user or API client issues a `GET /api/v1/search` with parameters (`q`, `scope`, `resourceTypes`, `page`, `limit`, `filters`).
   - Server validates pagination boundaries: `limit = Math.min(100, Math.max(1, limit))` (`INV-484`).
   - Server validates declarative AST filters (`INV-480`, `INV-481`, `INV-482`, `INV-483`).
2. **Authorized Provider Resolution**:
   - `resolveAuthorizedProviders` filters all 11 domain providers by target `scope` and compares each provider's `requiredPermission` against `caller.permissions` (`INV-479`).
3. **Cache Lookup**:
   - Computes SHA-256 fingerprint of permissions and query parameters.
   - Queries `CacheService.get(tenantKey)` (`INV-498`). Returns cached result on hit (TTL 30 seconds).
4. **Bounded Concurrency Execution**:
   - Dispatches parallel queries across resolved providers using `boundedParallel` with worker concurrency pool of 5.
   - Aggregates individual `SearchRecord` arrays.
5. **Relevance Ranking & Tie-Breaking**:
   - `SearchRankingService.rankAndSort` assigns relevance scores and sorts deterministically (`INV-485`).
6. **Telemetry & Asynchronous Tracking**:
   - Persists search query to user history asynchronously if `recordHistory: true` (`INV-486`).
   - Emits sanitized analytics telemetry record (`INV-499`).
