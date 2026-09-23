# 18 — Caching Strategy Guide

## Architecture

The search service leverages the M36 `CacheService` to cache frequent queries with high temporal locality.

## Cache Key Structure (`INV-498`)

Cache keys are formed as follows:

```
tenant:{organizationId}:search:{permissionsHash}:{queryHash}
```

Where:

- `organizationId`: Tenant isolation boundary
- `permissionsHash`: SHA-256 (first 16 chars) of sorted permissions held by the caller
- `queryHash`: SHA-256 of normalized JSON `{ q, scope, resourceTypes, filters, page, limit }`

## TTL & Invalidation Policy

- **Default Search TTL**: 30 seconds.
- **Tenant Invalidation**: Mutations in underlying records or saved views trigger `cacheService.invalidateNamespace(orgId, 'search')`.
