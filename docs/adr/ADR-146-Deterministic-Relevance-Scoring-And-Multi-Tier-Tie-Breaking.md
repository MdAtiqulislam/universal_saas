# ADR-146: Deterministic Relevance Scoring and Multi-Tier Tie-Breaking

**Status:** Accepted  
**Date:** 2026-09-11  
**Milestone:** M44

## Context

Unified search aggregates results across multiple heterogeneous models and tables. Non-deterministic ranking results in pagination jitter, fluctuating item positions across page transitions, and poor user trust.

## Decision

1. **Deterministic Scoring Formula (`INV-485`)**:
   - Exact ID Match: +1000 points
   - Exact Title Match: +800 points
   - Prefix Title Match: +500 points
   - Substring in Title: +300 points
   - Token Matches in Title/Subtitle: +150 points per token (capped at 400)
   - Substring in Description/Subtitle: +100 points
   - Recency Bonus: Linear decay over 90 days from +50 to 0 points based on `createdAt`
2. **Multi-Tier Stable Tie-Breaking (`INV-485`)**:
   - Tier 1: `score` DESC
   - Tier 2: `createdAt` DESC
   - Tier 3 (Authoritative Tie-Breaker): `id` ASC
3. **Tenant-Isolated Cached Results (`INV-498`)**:
   - Cache keys incorporate tenant organization ID (`CacheService.tenantKey`), caller permissions SHA-256 hash, and normalized query parameters hash to prevent cross-tenant or privilege-escalated cache leaks.

## Consequences

- Identical queries against identical data produce bit-for-bit identical ranked lists and pagination slices.
- Eliminates duplicate or skipped records when users paginate through large operational datasets.
