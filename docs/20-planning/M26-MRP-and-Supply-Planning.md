# Milestone M26: Material Requirements Planning (MRP) & Supply Planning Foundation

## 1. Executive Summary

Milestone M26 delivers a production-grade, multi-tenant Material Requirements Planning (MRP) and Supply Planning engine for the Universal Business Operations SaaS platform. The engine synthesizes gross demand across open sales orders (M11) and active production orders (M25), balances existing on-hand inventory (M09) and open purchase/production order supplies (M10/M25), executes recursive multi-level BOM explosion (M25) with scrap considerations, and calculates precise time-phased net material requirements and lot-sized planned orders.

---

## 2. Architecture & Data Model

### 2.1 Core Entities

1. **`PlanningConfiguration`**: Tenant-level planning policy parameters (default planning horizon, default lead times, safety stock inclusion, demand toggles).
2. **`ItemPlanningProfile`**: Item- and variant-specific planning rules (lead time in days, safety stock quantity, reorder points, MOQ, order multiples, preferred supplier, preferred BOM).
3. **`PlanningRun`**: MRP execution header tracking planning horizons, run status (`DRAFT` $\to$ `RUNNING` $\to$ `COMPLETED` / `FAILED` / `CANCELLED`), demand/supply counts, shortage counts, and execution timestamps.
4. **`PlanningDemand`**: Immutable snapshot of demand inputs (Sales Orders, Production Orders, Safety Stock).
5. **`PlanningSupply`**: Immutable snapshot of supply inputs (On-Hand available stock, Open Purchase Orders, Open Production Order outputs).
6. **`PlanningResult`**: Calculated item-level net requirements, available quantities, suggested action (`PURCHASE`, `PRODUCTION`, `EXPEDITE`, `SHORTAGE`), and time-phased dates.
7. **`PlannedOrder`**: Actionable recommendation records (`PLN-000001`) with lot sizing (MOQ / order multiples), planned order dates (lead time offset), and preferred vendors/BOMs.

---

## 3. Net Requirements & Planning Formulas

$$\text{AvailableStock} = \text{QuantityOnHand} - \text{QuantityReserved}$$

$$\text{GrossDemand} = \sum \text{OpenSalesOrderLines} + \sum \text{ActiveProductionOrderComponentDemands}$$

$$\text{ExpectedSupply} = \sum \text{OpenPurchaseOrders} + \sum \text{OpenProductionOutputs}$$

$$\text{NetRequirement} = \max(0, \text{GrossDemand} + \text{SafetyStock} - \text{AvailableStock} - \text{ExpectedSupply})$$

### Lot Sizing & Lead Time Offsetting:

- If $\text{NetRequirement} < \text{MOQ}$, order quantity is bumped to $\text{MOQ}$.
- If $\text{OrderMultiple} > 1$, order quantity is rounded up to next integer multiple.
- $\text{PlannedOrderDate} = \text{RequiredDate} - \text{LeadTimeDays}$.
- If $\text{PlannedOrderDate} < \text{Now}$, the planned order is flagged as a critical **Shortage / Expedite** exception.

---

## 4. Multi-Tenant Isolation & Security

- All MRP operations are strictly scoped by `organizationId`.
- Granular RBAC permissions:
  - `planning.runs.view`, `planning.runs.manage`, `planning.runs.execute`
  - `planning.results.view`, `planning.shortages.view`, `planning.reports.view`
  - `planning.configuration.view`, `planning.configuration.manage`
  - `planning.planned-orders.view`
- Domain audit events for run execution lifecycle, configuration changes, shortage alerts, and planned order generations.
