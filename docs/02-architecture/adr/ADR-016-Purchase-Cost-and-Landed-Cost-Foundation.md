# ADR-016: Purchase Cost & Landed-Cost Data Foundation

**Status:** ACCEPTED  
**Date:** 2026-08-28  
**Deciders:** Lead Architect, Database Architect  
**Technical Milestone:** M10 — Suppliers & Purchasing Management

---

## Context & Problem Statement

Purchasing physical goods often incurs auxiliary expenses beyond base item purchase prices, including international freight, customs clearance, import tariffs/duties, transit insurance, and port handling fees.

While full inventory valuation and accounting cost-layer adjustments belong to future financial milestones, M10 requires establishing the **data model foundation** to record and associate ancillary costs with purchase orders and goods receipts.

---

## Decision Drivers

1. **Clear Architectural Boundaries:** Establish structured data models without prematurely inventing a complex accounting journal engine.
2. **Tenant Isolation:** Auxiliary costs must be strictly isolated per tenant.
3. **Multi-Currency Support:** Costs may be billed in foreign currencies (e.g. USD shipping for EUR goods).
4. **Flexible Allocation Methods:** Record intended cost distribution methodology (`BY_VALUE`, `BY_QUANTITY`, `BY_WEIGHT`, `EQUAL`).

---

## Decision Outcome

**Chosen Option:** **Normalized `purchase_cost_allocations` entity linked optionally to `purchase_orders` or `goods_receipts` with explicit `cost_type` and `allocation_method` enums**.

### Data Model Schema

```
┌────────────────────────────────────────────────────────┐
│               PurchaseCostAllocation                   │
├────────────────────────────────────────────────────────┤
│ • id: UUID PK                                          │
│ • organization_id: UUID                                │
│ • purchase_order_id: UUID?                             │
│ • goods_receipt_id: UUID?                              │
│ • cost_type: SHIPPING | CUSTOMS | DUTY | INSURANCE ... │
│ • amount: DECIMAL(18, 4) (> 0)                         │
│ • currency_id: UUID                                    │
│ • allocation_method: BY_VALUE | BY_QUANTITY | ...      │
│ • notes: TEXT?                                         │
└────────────────────────────────────────────────────────┘
```

### Positive Consequences

- Clean, extensible foundation for future landed-cost calculation and COGS valuation engines.
- Strict multi-tenant data isolation and database-level positive amount validation.
