# ADR-039: Return to Inventory and Accounting Strategy

## Status

Accepted

## Context

Commercial adjustments for customer credit notes and supplier debit notes often correspond to physical goods movements (customer returns, vendor returns, scraps). The system must record stock mutations without duplicating inventory ledger engines.

## Decision

1. **Reuse M09 BalancesService**:
   - Return-to-inventory logic delegates directly to `BalancesService.applyStockMovement` passing the active Prisma transaction client (`tx`).
   - Customer Returns (`RESTOCK` disposition): Execute `StockMovementType.RECEIPT` at the specified warehouse location.
   - Supplier Returns: Execute `StockMovementType.ISSUE` at the specified warehouse location.
   - Damaged / Scrap Returns (`SCRAP` disposition): No sellable balance increment occurs; recorded as scrap transaction.
2. **Atomic Execution**:
   - GL journal creation and stock balance updates execute within a single database transaction. If either fails, the entire adjustment rolls back.

## Consequences

- **Positive**: Strict inventory consistency, single source of truth for stock balances and warehouse movements.
- **Negative**: Posting requires available stock and valid warehouse location specifications.
