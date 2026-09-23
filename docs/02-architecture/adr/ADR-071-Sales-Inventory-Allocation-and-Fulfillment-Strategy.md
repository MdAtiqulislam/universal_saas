# ADR-071: Sales Inventory Allocation and Fulfillment Strategy

## Status

Accepted

## Context

Sales orders must allocate physical warehouse stock to ensure orders can be fulfilled without creating phantom stock commitments or over-reservations.

## Decision

1. Reuse M09 `InventoryReservation` and `InventoryBalance` engines. Do not create duplicate inventory reservation tables.
2. Provide read-only stock availability checks via `checkAvailability()`, computing `ordered`, `onHand`, `alreadyReserved`, `available`, `fulfillable`, and `shortage` without database mutations.
3. Transactionally allocate stock via `allocate()`:
   - For each line item, compute allocatable stock = `min(remainingToDeliver - quantityReserved, availableOnHand)`.
   - Create M09 `InventoryReservation` with status `ACTIVE`.
   - Increment `InventoryBalance.quantityReserved`.
   - Transition sales order status to `ALLOCATED` (if 100% reserved) or `PARTIALLY_RESERVED`.
4. Provide `releaseAllocation()` to atomically revert active reservations and decrement `InventoryBalance.quantityReserved`.

## Consequences

- Single source of truth for inventory balance and reservation state.
- Accurate real-time ATP (Available-to-Promise) metrics.
