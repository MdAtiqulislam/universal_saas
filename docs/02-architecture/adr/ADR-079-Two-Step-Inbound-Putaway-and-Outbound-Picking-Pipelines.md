# ADR 079: Two-Step Inbound Putaway and Outbound Picking Pipelines

## Status

Accepted

## Context

Standard inventory transfers in simple systems immediately assume stock in available locations or immediate decrement on sales order creation. In enterprise warehouse execution, receiving occurs at a loading dock (`RECEIVING`), requiring physical putaway tasks into specific bins (`STORAGE` / `PICK_FACE`). Conversely, outbound orders require reserving stock (M09), generating pick tasks/waves, physically retrieving goods, and moving them to shipping dispatch (`STAGING`).

## Decision

1. Implement `PutawayTask` and `PutawayTaskLine` to transition stock from receiving docks to assigned storage bins. Execution utilizes M09 `BalancesService.applyStockMovement` using `TRANSFER_OUT` and `TRANSFER_IN` within an atomic database transaction.
2. Implement `PickTask` and `PickTaskLine` linked to Sales Orders or Delivery Orders, respecting M09 active reservations. Picking physically transfers stock to `STAGING` location, preparing it for M29 shipment dispatch.
3. Support Wave Picking (`PickWave`) to aggregate multiple picking orders into single operational runs.

## Consequences

- Physical stock movement faithfully mirrors actual warehouse floor operations.
- Accurate real-time tracking of dock-to-stock cycle times and pick fulfillment rates.
- Strict concurrency safety and idempotency prevent double-allocation or phantom movements.
