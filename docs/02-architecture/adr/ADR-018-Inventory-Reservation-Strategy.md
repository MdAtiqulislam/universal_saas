# ADR-018: Inventory Reservation and Concurrency Protection Strategy

## Status

Accepted

## Context

When sales orders are confirmed, businesses must avoid double-selling stock across parallel channels or multiple sales reps. We needed an inventory reservation mechanism that prevents over-commitment while guaranteeing concurrency safety under high order throughput.

## Decision

### 1. Reservation Formula & Invariants

Inventory balances maintain two core physical quantities per location/item/variant:

- `quantityOnHand`: The physical stock residing in the warehouse.
- `quantityReserved`: The allocated portion of stock pledged to active sales orders.

$$\text{Available Stock} = \max(0, \text{quantityOnHand} - \text{quantityReserved})$$

When confirming a Sales Order:

1. For each order line, $\text{qtyToReserve} = \min(\text{line.quantity}, \text{Available Stock})$.
2. If $\text{qtyToReserve} > 0$:
   - An `InventoryReservation` entity is created with status `ACTIVE`.
   - `InventoryBalance.quantityReserved` is incremented by $\text{qtyToReserve}$.
   - `SalesOrderLine.quantityReserved` is updated to $\text{qtyToReserve}$.
3. If $\text{qtyToReserve} == 0$, the order remains `CONFIRMED` but unreserved.

### 2. Concurrency Safety

Stock reservation operations occur inside atomic database transactions (`prisma.$transaction`). In PostgreSQL, balance row updates acquire row-level locks (`FOR UPDATE`), ensuring that parallel confirmations serialize their evaluation of available stock. Total reserved stock across all active orders is mathematically constrained never to exceed `quantityOnHand`.

### 3. Reservation Lifecycle

- `ACTIVE`: Dedicated to an active sales order.
- `FULFILLED`: The stock has been physically picked and issued via a `DeliveryOrder`.
- `RELEASED`: The sales order was cancelled or the reservation was manually revoked, decrementing `quantityReserved` and returning the stock to general availability.

## Consequences

- **Positive**: Eliminates overselling; transparent visibility into available-to-promise (ATP) inventory.
- **Negative**: Stock is locked immediately upon order confirmation until delivery or cancellation.
