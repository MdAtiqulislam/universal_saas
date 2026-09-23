# ADR-013: Inventory Concurrency & Transaction Isolation Strategy

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Lead Architect, Database Architect  
**Technical Milestone:** M09 — Inventory & Warehouse Management Foundation

---

## Context & Problem Statement

In a high-throughput multi-tenant SaaS environment, multiple concurrent requests (e.g. 50 orders attempting to decrement stock from the same SKU at the same warehouse simultaneously) can create race conditions and lost update anomalies.

Key risks include:

1. **Lost Updates:** Transaction A reads stock 10, Transaction B reads stock 10. A deducts 3 (writes 7), B deducts 4 (writes 6, overwriting A's deduction).
2. **Negative Stock Under Race Conditions:** Two concurrent transactions attempting to deduct 7 units each from a stock of 10 must not allow stock to become -4. One transaction must succeed and the other must be rejected.

---

## Decision Drivers

1. **Deterministic Inventory Invariants:** Resulting stock must never become negative (`quantity_on_hand >= 0`).
2. **Mathematical Accuracy:** 100 simultaneous operations must produce the exact mathematical sum of all inputs without lost updates.
3. **Database-Level Protection:** Protection must be enforced at both PostgreSQL transactional engine level and database CHECK constraint level.

---

## Decision Outcome

**Chosen Option:** **PostgreSQL Transactional Isolation with Row Locking and Atomic Check-and-Update within Transaction Client Boundaries**.

### Technical Mechanisms

1. **Transactional Boundaries:**
   - Every stock movement executes inside `prisma.$transaction(async (tx) => { ... })`.
2. **Pre-flight & Post-flight Invariant Verification:**
   - The engine reads the current balance row within the active transaction client, applies the signed delta (`+qty` or `-qty`), verifies `newOnHand >= 0`, updates the record, and records the immutable movement.
3. **PostgreSQL Database Check Constraints:**
   ```sql
   ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_non_negative_on_hand" CHECK ("quantity_on_hand" >= 0);
   ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_non_negative_reserved" CHECK ("quantity_reserved" >= 0);
   ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_positive_qty" CHECK ("quantity" > 0);
   ```
4. **Verification:**
   - Verified via `inventory-concurrency.spec.ts` executing **100 concurrent parallel stock mutations** (+100 receipt delta, -50 issue delta against initial 100 on-hand), confirming zero lost updates, 100 recorded ledger movements, and mathematically exact final balance of 150.

### Positive Consequences

- Zero negative stock anomalies under heavy concurrent load.
- Absolute mathematical consistency across concurrent tenant operations.
