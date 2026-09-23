# ADR-015: Goods Receipt Posting and M09 Inventory Engine Integration

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Lead Architect, Database Architect  
**Technical Milestone:** M10 — Suppliers & Purchasing Management

---

## Context & Problem Statement

When physical shipments arrive from suppliers, receiving staff process goods receipts. This operation must bridge the commercial purchasing domain (`purchase_orders`, `goods_receipts`) with the physical warehouse inventory domain (`inventory_balances`, `inventory_batches`, `inventory_serials`, `stock_movements`).

Direct manipulation of inventory database rows by purchasing controllers would violate encapsulation and bypass tracking type invariants (batch and serial tracking rules established in M09).

---

## Decision Drivers

1. **Transactional Invariance:** Receiving physical stock into warehouse balances and updating purchase order received quantities must succeed or fail as a single atomic unit.
2. **Zero Over-Receiving:** Received quantity must strictly never exceed ordered remaining quantity.
3. **Encapsulation:** All stock movement logic must route through `BalancesService.applyStockMovement()`.
4. **Idempotency & Concurrency Safety:** Multiple parallel receipts or re-posting attempts must never result in double-receipt or phantom stock.

---

## Decision Outcome

**Chosen Option:** **Two-Phase Receiving (Draft -> Post) executing via Centralized M09 `BalancesService.applyStockMovement` inside strict Transaction Client boundaries**.

### Execution Pipeline (`GoodsReceiptsService.postReceipt`)

1. **Pre-condition Validation:**
   - Assert `goodsReceipt.status === DRAFT`.
   - Assert `purchaseOrder.status IN [APPROVED, PARTIALLY_RECEIVED]`.
2. **Atomic Transaction Scope (`prisma.$transaction(async (tx) => { ... })`):**
   - For each receipt line:
     - Verify `receiptLine.quantity <= (poLine.quantity - poLine.receivedQuantity)`.
     - Execute `BalancesService.applyStockMovement(organizationId, { locationId, itemId, variantId, movementType: RECEIPT, quantity, batchId, serialId, referenceType: 'GOODS_RECEIPT', referenceId: receiptNumber }, actorUserId, tx)`.
     - Increment `poLine.receivedQuantity` by `receiptLine.quantity`.
   - Re-evaluate PO status:
     - If all lines fulfilled $\implies$ `RECEIVED`.
     - Else $\implies$ `PARTIALLY_RECEIVED`.
   - Mark `goodsReceipt.status = POSTED`.
3. **Event Dispatch:**
   - Publish `GOODS_RECEIPT_POSTED` and `STOCK_RECEIVED` domain events.

### Positive Consequences

- Guarantees 100% synchronization between purchasing order fulfillment and warehouse stock availability.
- Prevents race conditions and duplicate physical receipts under concurrent warehouse operations.
