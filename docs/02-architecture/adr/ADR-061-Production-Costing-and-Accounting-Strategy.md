# ADR-061: Production Costing and Accounting Strategy

## Status

Accepted

## Context

Manufacturing introduces Work-in-Progress (WIP) accounting across component issuances, labor accruals, manufacturing overhead absorption, finished goods inventory capitalization, and production variance recognition. All GL entries must be balanced and integrated with General Ledger (M12).

## Decision

1. **Production Costing Formula**:
   $$\text{Total Production Cost} = \text{Direct Material Cost} + \text{Direct Labor Cost} + \text{Manufacturing Overhead Cost}$$
   $$\text{Unit Production Cost} = \frac{\text{Total Production Cost}}{\text{Produced Quantity}}$$
   - Uses exact `DECIMAL(20, 4)` arithmetic via `Prisma.Decimal`.
2. **Double-Entry General Ledger Postings**:
   - **Material Issuance**:
     - `Debit`: WIP Inventory Asset (`totalMaterialIssueCost`)
     - `Credit`: Raw Material Inventory Asset (`totalMaterialIssueCost`)
   - **Finished Goods Completion**:
     - `Debit`: Finished Goods Inventory Asset (`outputTotalCost`)
     - `Credit`: WIP Inventory Asset (`materialCostPortion`)
     - `Credit`: Direct Labor Applied / Accrued (`laborCost`)
     - `Credit`: Manufacturing Overhead Applied (`overheadCost`)
   - **Order Closure & Variance**:
     - `Debit` / `Credit`: Production Variance Account
     - `Credit` / `Debit`: WIP Inventory Offset
3. **M12 Accounting Engine Integration**:
   - All postings create `JournalEntry` and `JournalLine` records with `status = POSTED`, `sourceType = 'PRODUCTION_ORDER'`, and `sourceId = order.id`.

## Consequences

- Guarantees balanced double-entry General Ledger postings ($\text{Total Debits} = \text{Total Credits}$).
- Reconciles sub-ledger manufacturing costs with platform financial statements in real time.
