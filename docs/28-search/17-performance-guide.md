# 17 — Performance & Concurrency Guide

## Concurrency Controls

Global search spans 11 distinct PostgreSQL tables. Dispatched carelessly, this could trigger connection pool starvation and latency spikes under concurrent tenant traffic.

1. **Bounded Worker Pools**:
   - Provider queries execute through `boundedParallel` with `concurrency = 5`.
   - Protects Node.js event loop latency and avoids spike exhaustion of PostgreSQL client pools.
2. **Deterministic Pagination Bounds (`INV-484`)**:
   - `limit` parameter is capped at `MAX_PAGE_SIZE = 100`.
   - Prevents abusive requests attempting to fetch tens of thousands of records in a single synchronous call.
3. **Database Indexing**:
   - Indexes on `(organizationId, createdAt)` and `(organizationId, isDeleted)` across searchable entities guarantee index-backed queries.
   - Compound indexes on `(organizationId, status)` enable fast filtering on status fields.
