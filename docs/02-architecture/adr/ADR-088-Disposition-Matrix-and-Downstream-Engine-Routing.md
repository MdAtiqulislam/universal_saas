# ADR-088: Disposition Matrix and Downstream Engine Routing

## Context

When returned goods are physically received at the warehouse, they must not enter active sellable inventory without explicit inspection gating and disposition decisions. Different item conditions require disparate downstream operational handling: restocking, scrapping, rework/repair, or vendor return.

## Decision

1. Auto-Quarantine and Receiving:
   - Received returns default into dedicated warehouse return or quarantine locations (`Location`).
   - Received quantities are bounded by `authorizedQuantity`.
2. M31 Quality Inspection Integration:
   - Automatically links or creates an M31 `QualityInspectionLot` with context `CUSTOMER_RETURN`.
   - Inspection lot decision (`ACCEPT`, `REJECT`, `SCRAP`, `HOLD`, `DEVIATION`) directly gates permitted disposition types.
3. Disposition Execution:
   - Dispositions are tracked via `ReturnDispositionRecord` with strict validation: `totalDispositionQuantity <= acceptedQuantity` (or `receivedQuantity`).
   - Supported Dispositions:
     - `RESTOCK`: Transfers items to active warehouse bins at assessed valuation.
     - `SCRAP`: Writes off damaged material to scrap location with loss allocation.
     - `REPAIR` / `REWORK`: Routes material to manufacturing/repair shop floor (M25).
     - `REPLACE`: Authorizes replacement sales order fulfillment (M28).
     - `RETURN_TO_SUPPLIER`: Creates outbound supplier return (M27).
     - `REJECT_RETURN`: Marks item rejected with no physical acceptance.
     - `NO_ACTION`: Maintains quarantine status.

## Consequences

- Full physical and financial protection against substandard or contaminated stock returning to available inventory.
- Complete operational audit trail for each unit of returned material.
