# ADR 081: Isolated Quarantine Quality State Machine and Automated Replenishment

## Status

Accepted

## Context

Warehouse operations encounter damaged, unverified, or suspect goods that must be immediately segregated from available-to-promise (ATP) inventory. Similarly, forward pick faces frequently deplete and require rule-driven replenishment from bulk storage pallet racks to prevent picking stockouts.

## Decision

1. Implement `QuarantineRecord` with finite state machine transitions: `QUARANTINED` $\to$ `UNDER_INSPECTION` $\to$ `RELEASED`, `HELD`, `SCRAPPED`, or `RETURNED`.
2. Subtract active quarantined lots from available stock derivation across the warehouse platform.
3. Releasing quarantined goods restores availability, while scrapping or returning invokes authoritative inventory adjustment pipelines.
4. Implement `ReplenishmentRule` defining `minQuantity`, `maxQuantity`, and `replenishQuantity` between bulk storage sources and pick-face destinations.
5. Create `ReplenishmentTask` engine that dynamically evaluates pick face balances against rules and executes intra-warehouse replenishment moves atomically via M09 stock movements.

## Consequences

- Guaranteed ATP safety preventing damaged or quarantined stock from being allocated to sales orders.
- Automated replenishment prevents picking bottlenecks and maintains lean pick-face staging.
- Clear traceability for quality audits and vendor return documentation.
