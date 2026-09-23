# ADR-009: Concurrency-Safe Atomic Numbering Sequence Generation

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Senior Software Architect, Systems Architect  
**Technical Milestone:** M07 — Master Data & Configuration Management

---

## Context & Problem Statement

Documents in SaaS operations (invoices, sales orders, purchase orders, payments, shipments) require unique sequential numbering with configurable prefixes and zero-padding (e.g. `INV-000042`).

Under concurrent load (multiple users or API webhooks submitting orders simultaneously), traditional read-modify-write patterns (`SELECT next_number` -> `number + 1` -> `UPDATE`) cause race conditions resulting in duplicated numbers or lost updates.

---

## Decision Drivers

1. **Zero Duplicate Numbers:** Two concurrent requests for the same sequence key within a tenant must NEVER receive the same number.
2. **High Throughput & Low Latency:** Atomic row-level locking at the database layer without distributed Redis lock complexity.
3. **Flexible Formatting:** Support configurable prefix (e.g. `INV-`, `SO-`) and zero-padding (e.g. 6 digits -> `000042`).
4. **Tenant Scoping:** Sequence numbers are isolated per tenant (`organization_id`, `key`).

---

## Decision Outcome

**Chosen Option:** **PostgreSQL Single-Statement Atomic Update with RETURNING Clause**.

### Implementation Mechanism

```sql
UPDATE numbering_sequences
SET next_number = next_number + 1, updated_at = NOW()
WHERE organization_id = $1::uuid
  AND key = $2
  AND is_active = true
RETURNING (next_number - 1) AS allocated_number, prefix, padding;
```

### Architectural Guarantees

1. **Database Row Lock:** PostgreSQL locks the specific sequence row during the `UPDATE`, ensuring atomic increment and serialization of concurrent calls.
2. **Zero Gapless Guarantee Requirement:** Sequence allocation occurs immediately upon generation. If a downstream business transaction fails or rolls back, a number may be consumed (gap), which is standard for high-concurrency ERP/SaaS systems.
3. **Format Engine:** Returns `{ sequenceKey: "INVOICE", number: 42, formatted: "INV-000042" }`.

### Positive Consequences

- Zero duplicate numbers under high concurrency.
- Atomic execution without distributed lock managers.
- Proven scalability under concurrent load.
