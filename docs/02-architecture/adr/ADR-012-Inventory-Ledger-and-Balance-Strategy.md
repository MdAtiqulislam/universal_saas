# ADR-012: Immutable Stock Movement Ledger and Inventory Balance Architecture

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Lead Architect, Database Architect  
**Technical Milestone:** M09 — Inventory & Warehouse Management Foundation

---

## Context & Problem Statement

Accurate inventory tracking across multi-tenant operations requires answering two fundamental questions:

1. **Current State:** How much stock is on-hand, reserved, and available at each physical location right now?
2. **Audit & Traceability:** Exactly when, why, how, and by whom did stock levels change?

Relying solely on mutable balance counters risks unexplainable inventory drift. Conversely, calculating current balances exclusively via full table aggregation of all historical transactions on every query introduces extreme database overhead as transaction volume grows.

---

## Decision Drivers

1. **Auditability & Non-Repudiation:** Every physical unit added or removed must produce an immutable audit trail.
2. **Performance:** Querying stock availability for catalog lists or point-of-sale systems must be $O(1)$ fast.
3. **No Drift / Transactional Invariance:** The ledger movement and balance record must remain 100% synchronized at all times.
4. **Tenant Isolation:** Stock from Tenant A must never be modified, viewed, or combined with Tenant B.

---

## Decision Outcome

**Chosen Option:** **Dual-Model Architecture (Fast Materialized Balances + Append-Only Immutable Stock Ledger) synchronized inside strict Transactional Boundaries**.

### Core Architecture

1. **Immutable Movement Ledger (`stock_movements`):**
   - Append-only table. No `UPDATE` or `DELETE` endpoints or Prisma methods exist for stock movements.
   - Movements record `movementType` (`RECEIPT`, `ISSUE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`), `quantity` (strictly positive `DECIMAL(18, 4)`), `batchId`, `serialId`, `referenceType`, `referenceId`, `reason`, and `actorUserId`.
   - Inventory corrections are executed exclusively as new compensating movements (`ADJUSTMENT_IN` / `ADJUSTMENT_OUT`).

2. **Materialized Stock Balances (`inventory_balances`):**
   - Tenant-scoped composite unique record on `(organization_id, location_id, item_id, variant_id)`.
   - Maintains `quantity_on_hand` and `quantity_reserved`.
   - Available stock is calculated deterministically as `quantity_on_hand - quantity_reserved`.
   - Database constraint: `CHECK ("quantity_on_hand" >= 0)` and `CHECK ("quantity_reserved" >= 0)`.

3. **Centralized Transaction Engine (`BalancesService.applyStockMovement`):**
   - Direct manual mutations of `inventory_balances` are forbidden.
   - All balance updates must pass through `applyStockMovement()` within a single transactional boundary that checks tracking rules, adjusts balance, records movement, updates batch/serial state, and publishes domain events.

### Positive Consequences

- Real-time $O(1)$ stock balance lookups.
- 100% forensic auditability with zero possibility of historical record alteration.
- Strict multi-tenant isolation and mathematical consistency.
