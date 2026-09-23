# ADR-105: Pagination, Query Optimization & High-Volume API Strategy

## Status

Accepted

## Context

High-volume listing endpoints (sales orders, inventory movements, invoices, leads, activities) risk database memory exhaustion and degradation when unconstrained or using deep offset pagination.

## Decision

1. Enforce strict upper limit on page size (`MAX_PAGE_SIZE = 100`, default `20`) across all list endpoints.
2. Provide standardized Keyset/Cursor pagination (`CursorPaginationQueryDto`, `CursorPaginatedResult<T>`) alongside deterministic offset pagination.
3. Use base64url-encoded cursor tokens carrying `{ id, createdAt }`.
4. Enforce deterministic tie-breaker sorting: `createdAt DESC, id DESC`.

## Consequences

- Guaranteed bounded response payloads and predictable memory utilization.
- Fast, cursor-based forward traversal without deep-offset latency penalties.
