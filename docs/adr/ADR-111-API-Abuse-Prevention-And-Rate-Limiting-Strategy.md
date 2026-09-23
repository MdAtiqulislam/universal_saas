# ADR-111: API Abuse Prevention And Rate Limiting Strategy

## Status

Accepted

## Context

High-volume API endpoints must be safeguarded against volumetric abuse, credential brute-forcing, scraping, and denial-of-service attempts while preventing cross-tenant quota contention.

## Decision

1. **Sliding-Window In-Memory Rate Limiter**: Maintain bounded, memory-efficient sliding-window token buckets partitioned by tenant organization and API key/IP scope.
2. **Deterministic Rate Enforcement**: Once requests exceed tenant policy thresholds (default 120 req/min/tenant), subsequent calls are rejected with HTTP 429 and logged as `API_ABUSE` security events.
3. **Graceful Window Reset**: Sliding expiration guarantees expired rate limits never permanently lock out legitimate users.
4. **Tenant-Partitioned Quotas**: Exhausting rate limit quotas in Tenant A has zero impact on Tenant B.

## Consequences

### Positive

- Prevents API abuse and DoS attacks.
- Provides immediate audit alerting when anomalous request volumes occur.
- Zero cross-tenant rate limit interference.

### Negative

- Distributed deployments across multiple independent worker nodes will require Redis-backed sliding window synchronization in future high-scale milestones.
