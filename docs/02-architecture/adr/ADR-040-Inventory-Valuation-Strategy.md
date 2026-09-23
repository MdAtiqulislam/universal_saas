# ADR-040: Inventory Valuation and Weighted Average Costing Strategy

## Status

Accepted

## Context

Accurate financial reporting and inventory accounting require a robust, deterministic valuation strategy that updates continuously as stock is procured, issued, adjusted, or returned.

## Decision

1. **Weighted Average Cost (WAC)**:
   - Primary operational valuation method calculated dynamically on inbound inventory additions:
     $$\text{New Average Cost} = \frac{(\text{Current Qty} \times \text{Current Avg Cost}) + (\text{Incoming Qty} \times \text{Incoming Unit Cost})}{\text{Current Qty} + \text{Incoming Qty}}$$
   - Outbound issues reduce quantity while holding unit cost steady.
2. **Location-Aware Valuation**:
   - Valuations are tracked per `(organizationId, itemId, variantId, locationId)` in `InventoryValuation`.
3. **Decimal Precision**:
   - All financial and quantity calculations utilize PostgreSQL `DECIMAL(18, 4)` and `DECIMAL(20, 4)` via `Prisma.Decimal`. Binary floating-point arithmetic is strictly prohibited.

## Consequences

- **Positive**: Smooth, stable cost progression without artificial price spikes; exact reconciliation with General Ledger assets.
- **Negative**: Historical point-in-time WAC reconstruction requires replay or snapshot indexing.
