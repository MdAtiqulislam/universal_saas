# ADR-060: Production Inventory and WIP Integration

## Status

Accepted

## Context

Manufacturing execution involves physical raw material issues and finished goods receipts that must integrate with existing inventory valuation (M09, M19), batch tracking, and serial tracking without duplicating inventory mutation logic or causing negative stock discrepancies.

## Decision

1. **Centralized Stock Mutation Reuse**:
   - Issue material mutations use `BalancesService.applyStockMovement` with `StockMovementType.ISSUE` and `referenceType = 'PRODUCTION_ORDER'`.
   - Finished goods receipts use `BalancesService.applyStockMovement` with `StockMovementType.RECEIPT`.
2. **FIFO Cost Layer Depletion & Creation**:
   - Material issuances consume inventory cost layers chronologically via `InventoryCostLayersService.consumeFifo(...)` to obtain exact historical cost amounts.
   - Finished goods receipts create inbound inventory cost layers via `InventoryCostLayersService.createLayer(...)` using the calculated unit production cost.
3. **Batch & Serial Tracking Integration**:
   - For batch-controlled components and products, update and link `InventoryBatch`.
   - For serial-controlled items, enforce valid serial selection, update serial status to `TRANSFERRED` on issue, and generate unique serial records with status `AVAILABLE` on completion.

## Consequences

- Preserves absolute stock consistency across purchasing, inventory, manufacturing, and sales.
- Completely reuses the authoritative FIFO/WAC costing engine without duplicate tracking systems.
