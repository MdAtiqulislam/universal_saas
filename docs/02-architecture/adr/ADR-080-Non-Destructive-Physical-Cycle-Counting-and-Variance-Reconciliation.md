# ADR 080: Non-Destructive Physical Cycle Counting and Variance Reconciliation

## Status

Accepted

## Context

Physical inventory counts must not directly mutate live inventory balances during counting, as counting is an exploratory auditing action that may involve recounts, recounts verification, blind auditing, and managerial review. Directly altering stock quantities on user input creates audit hazards and breaks M12 general ledger consistency.

## Decision

1. Introduce `CycleCount` and `CycleCountLine` with explicit lifecycle stages: `DRAFT` $\to$ `SCHEDULED` $\to$ `IN_PROGRESS` $\to$ `COUNTED` $\to$ `REVIEWED` $\to$ `POSTED` (or `CANCELLED`).
2. Snapshot system on-hand quantities upon count initiation (`systemQuantity`). Mask this value from counting staff when `isBlind = true`.
3. Calculate variances explicitly as $\text{varianceQuantity} = \text{countedQuantity} - \text{systemQuantity}$.
4. Variances are strictly posted only when the count status reaches `REVIEWED`, delegating the adjustments through M09 `BalancesService.applyStockMovement` using `ADJUSTMENT_IN` (for gains) and `ADJUSTMENT_OUT` (for shrinkage/losses), triggering M19 inventory costing valuation and M12 General Ledger journal entries.

## Consequences

- Full auditability of physical stock adjustments with clear lineage from count plan to financial ledger.
- Separation of physical counting duties from financial posting approvals.
- High accuracy metric reporting without risk of corrupted stock state during in-flight counting.
