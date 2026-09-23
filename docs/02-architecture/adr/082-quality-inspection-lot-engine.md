# ADR 082: Quality Inspection Lot Engine & Disposition Immutability

## Status

Accepted

## Context

In an enterprise ERP platform, Quality Management orchestrates quality verification across incoming procurement, shop-floor manufacturing, warehouse storage, and outgoing customer shipments. Prior to M31, inventory movement and physical quarantine were managed through M06/M30 inventory layers, but there was no formal inspection lot lifecycle, characteristic measurement engine, or authoritative quality disposition system.

A core requirement is ensuring that Quality Management functions as an inspection, auditing, and disposition orchestration domain without creating a secondary inventory balance ledger or duplicating GL accounting.

## Decision

1. **Quality Inspection Lot as Core Execution Entity**:
   - Every quality inspection event creates a `QualityInspectionLot` linked to material coordinates (`itemId`, optional `variantId`, `warehouseId`, `locationId`, optional `batchId`/`serialId`).
   - Supports 7 inspection operational contexts: `INCOMING_PURCHASE`, `IN_PROCESS_MANUFACTURING`, `FINISHED_GOODS`, `OUTGOING_SHIPMENT`, `CUSTOMER_RETURN`, `INTERNAL_TRANSFER`, and `ROUTINE_AUDIT`.
   - Links optionally to source documents: `PurchaseOrder`, `GoodsReceipt`, `ProductionOrder`, `DeliveryOrder`, `Shipment`, `Supplier`, and `Customer`.

2. **Authoritative Quality Dispositions**:
   - When inspection concludes, the system evaluates all recorded characteristic results across sample units.
   - The authoritative decision (`ACCEPT`, `ACCEPT_WITH_DEVIATION`, `REWORK`, `REJECT`, `SCRAP`, `RETURN_TO_SUPPLIER`, `HOLD`) transitions the lot status to `DECIDED`.

3. **Disposition Immutability & Audit Trail**:
   - Upon transition to `DECIDED`, the lot and all underlying `InspectionResult` records are marked `isImmutable = true`.
   - Any subsequent attempt to mutate recorded measurements or modify the disposition decision is rejected with a `400 Bad Request`.
   - An immutable audit event (`INSPECTION_DECISION_MADE`) is emitted through the event bus.

4. **Quarantine & Hold Orchestration**:
   - On non-accept decisions (`REJECT`, `SCRAP`, `REWORK`, `RETURN_TO_SUPPLIER`, `HOLD`), the engine automatically creates a `QualityHold` record to isolate the stock and triggers non-conformance remediation without duplicating physical stock balance ledgers.

## Consequences

### Positive

- Strict auditability and compliance with ISO 9001 and IATF 16949 quality standards.
- Clear separation between inventory physical movement and quality audit decisions.
- Tamper-proof historical inspection records.

### Negative

- Erroneous inspection entries must be handled through formal deviation/re-inspection workflows rather than in-place edits.
