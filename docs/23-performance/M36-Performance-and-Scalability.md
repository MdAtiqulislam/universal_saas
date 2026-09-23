# M36: Platform Performance, Scalability & Concurrency Foundation

## Executive Summary

Milestone M36 hardens the Universal Business Operations SaaS platform for enterprise-scale multi-tenant workloads. M36 introduces database query optimization, composite index tuning, cursor/keyset pagination standards, N+1 query elimination, deterministic idempotency protection, tenant-safe caching abstractions, a background job execution engine, bounded concurrency utilities, a repeatable performance benchmark suite, and high-contention concurrency load tests.

All performance optimizations operate strictly within established business domain boundaries, preserving multi-tenant isolation, RBAC permissions, audit events, accounting immutability, and deterministic calculations without duplicating tables or altering existing domain behavior.

---

## 1. Architectural Highlights

### 1.1 Database Indexing & Query Tuning

- Added targeted composite indexes on high-cardinality and tenant-scoped tables:
  - `sales_orders`: `[organization_id, status, created_at]`
  - `customer_invoices`: `[organization_id, status, created_at]`
  - `payments`: `[organization_id, status, created_at]`
  - `return_requests`: `[organization_id, status, created_at]`
  - `crm_leads`: `[organization_id, status, created_at]`
  - `crm_opportunities`: `[organization_id, status, created_at]`
- Added dedicated tables for replay protection (`idempotency_records`) and background task queuing (`background_jobs`).

### 1.2 Pagination Standards

- **Maximum Page Size**: Strictly clamped to `MAX_PAGE_SIZE = 100` (default `20`).
- **Keyset / Cursor Pagination**: Implemented `CursorPaginationQueryDto` with base64url-encoded tokens carrying `{ id, createdAt }` for fast forward traversal.
- **Deterministic Tie-Breaker**: All paginated queries sort by `createdAt DESC, id DESC`.

### 1.3 Concurrency & Idempotency Engine

- Tenant-scoped idempotency key management (`IdempotencyService`) preventing duplicate payment capture, goods receipt, or quotation conversion.
- `PENDING` status guards against race conditions and concurrent requests with `409 Conflict`.
- `COMPLETED` status enables automatic cached replay of HTTP status codes and response bodies.
- Concurrency utilities: `boundedParallel`, `chunkedExecution`, and `retryWithBackoff`.

### 1.4 Multi-Tenant Caching Layer

- Key structure: `tenant:{organizationId}:{namespace}:{key}`.
- Restricted to static configuration, RBAC permissions, and master-data dictionaries.
- Strict isolation invariant: Mutable financial and inventory ledgers are never cached.

### 1.5 Asynchronous Background Job Framework

- `JobService` backed by `background_jobs` table.
- Lifecycle: `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED` / `CANCELLED`.
- Bounded concurrency worker pool executing long-running reports, MRP runs, and reconciliations.

---

## 2. Database Invariants (276–300)

| Invariant | Description                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **276**   | Pagination limit is strictly bounded by MAX_PAGE_SIZE (100 items maximum).                                                     |
| **277**   | Offset pagination enforces deterministic sorting (`createdAt DESC, id DESC`).                                                  |
| **278**   | Keyset cursor pagination encodes and decodes URL-safe cursor tokens deterministically.                                         |
| **279**   | Pagination queries maintain strict tenant isolation (`organizationId` predicate is always required).                           |
| **280**   | Idempotency record is uniquely identified by composite (`organizationId, idempotencyKey`).                                     |
| **281**   | Idempotency record status must be `PENDING`, `COMPLETED`, or `FAILED`.                                                         |
| **282**   | Completed idempotency record caches HTTP status code and response payload for deterministic replay.                            |
| **283**   | Expired idempotency records (`expiresAt < now`) can be safely evicted or recycled.                                             |
| **284**   | Concurrent duplicate mutations with `PENDING` idempotency key are rejected with 409 Conflict.                                  |
| **285**   | Tenant cache keys are strictly prefixed by organizationId (`tenant:{orgId}:{namespace}:{key}`).                                |
| **286**   | Invalidation of a tenant cache namespace does not affect other organizations.                                                  |
| **287**   | Mutable transactional ledgers (inventory balances, GL journals) must never be served from stale cache.                         |
| **288**   | `BackgroundJob` is uniquely scoped to an `organizationId`.                                                                     |
| **289**   | `BackgroundJob` lifecycle transitions: `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED` / `CANCELLED`.                        |
| **290**   | `BackgroundJob` priority ordering executes higher priority jobs first.                                                         |
| **291**   | `BackgroundJob` cancellation is permitted only for non-terminal jobs (`PENDING`, `PROCESSING`).                                |
| **292**   | Bounded parallel worker limits concurrency to prevent database connection starvation.                                          |
| **293**   | Chunked execution processes large bulk collections in bounded slices without unbounded memory growth.                          |
| **294**   | Transaction duration is minimized by performing expensive validations prior to opening database transactions.                  |
| **295**   | Consistent lock ordering prevents deadlocks during concurrent multi-resource mutations.                                        |
| **296**   | Transient transaction serialization failures can be retried safely with exponential backoff.                                   |
| **297**   | Authoritative database-side aggregations (`SUM`, `COUNT`) avoid N+1 application-side object graph loading.                     |
| **298**   | Performance benchmarking measures p50, p95, p99 latencies, throughput, and execution counts against actual queries.            |
| **299**   | High-volume composite indexes support combined tenant, status, and `createdAt` sorting queries.                                |
| **300**   | Multi-tenant isolation invariant: All performance optimizations, caches, jobs, and indexes maintain zero cross-tenant leakage. |
