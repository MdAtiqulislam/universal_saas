# Milestone M25 — Manufacturing & Production Management Foundation

## 1. Executive Summary

Milestone **M25** delivers a production-grade, multi-tenant ERP manufacturing and production management engine for the Universal Business Operations SaaS platform. The module provides multi-tenant Bill of Materials (BOM) management, production order execution lifecycle, material consumption and FIFO cost layer tracking, finished goods receipt, Work-in-Progress (WIP) double-entry accounting (M12), manufacturing costing (M19), scrap & production variance tracking, material availability planning, granular RBAC, and domain audit events.

---

## 2. Domain Entities & Database Schema

### A. Bill of Materials (`bill_of_materials`, `bill_of_material_lines`)

- **Aggregate Header**: `bom_number` (`BOM-000001`), `name`, `item_id`, `variant_id`, `quantity`, `uom_id`, `version`, `status` (`DRAFT`, `ACTIVE`, `INACTIVE`, `OBSOLETE`, `ARCHIVED`), `effective_from`, `effective_until`.
- **Component Lines**: `item_id`, `variant_id`, `quantity`, `uom_id`, `scrap_percentage`, `line_number`.
- **Invariants**:
  - Direct self-reference check ($line.itemId \neq header.itemId$).
  - Recursive circular BOM dependency prevention across multi-level sub-assemblies.
  - Immutability: BOMs referenced by active or completed production orders cannot be mutated.

### B. Production Orders (`production_orders`, `production_order_lines`)

- **Lifecycle**: `DRAFT` $\to$ `RELEASED` $\to$ `IN_PROGRESS` $\to$ `PARTIALLY_COMPLETED` $\to$ `COMPLETED` $\to$ `CLOSED`. Terminal states: `CANCELLED`, `VOIDED`.
- **Aggregate Header**: `order_number` (`MO-000001`), `item_id`, `bom_id`, `planned_quantity`, `produced_quantity`, `scrap_quantity`, `location_id`, planned/actual dates, and financial fields (`material_cost`, `labor_cost`, `overhead_cost`, `total_cost`, `unit_cost`).
- **Component Lines**: `required_quantity`, `issued_quantity`, `returned_quantity`, `consumed_quantity`, `scrap_quantity`, `unit_cost`, `total_cost`, `status` (`PENDING`, `PARTIALLY_ISSUED`, `FULLY_ISSUED`, `OVER_ISSUED`, `RETURNED`).

### C. Execution Ledger (`production_material_issues`, `production_outputs`)

- **Material Issue**: Atomic stock deduction via `BalancesService.applyStockMovement` (`StockMovementType.ISSUE`), FIFO cost depletion, batch/serial tracking, and WIP GL journal creation.
- **Finished Goods Receipt**: Inbound stock receipt (`StockMovementType.RECEIPT`), inbound M19 cost layer creation with unit production cost, batch lot generation, serial creation, and Finished Goods GL journal creation.

---

## 3. Production Costing & WIP Accounting

### A. Costing Model

$$\text{Total Production Cost} = \text{Direct Material Cost} + \text{Direct Labor Cost} + \text{Manufacturing Overhead Cost}$$
$$\text{Unit Production Cost} = \frac{\text{Total Production Cost}}{\text{Produced Quantity}}$$

### B. Double-Entry General Ledger Flow (M12)

1. **Material Issuance**:
   - `Debit`: WIP Inventory (`totalIssueCost`)
   - `Credit`: Raw Material Inventory Asset (`totalIssueCost`)
2. **Finished Goods Completion**:
   - `Debit`: Finished Goods Inventory (`outputTotalCost`)
   - `Credit`: WIP Inventory (`materialPortion`)
   - `Credit`: Direct Labor Applied (`laborCost`)
   - `Credit`: Manufacturing Overhead Applied (`overheadCost`)
3. **Order Closure & Variance**:
   - `Debit` / `Credit`: Production Variance
   - `Credit` / `Debit`: WIP Inventory Offset

---

## 4. REST API Reference

| Method   | Endpoint                                                 | Permission                           | Description                       |
| :------- | :------------------------------------------------------- | :----------------------------------- | :-------------------------------- |
| `POST`   | `/api/v1/manufacturing/boms`                             | `manufacturing.boms.manage`          | Create a new Bill of Materials    |
| `GET`    | `/api/v1/manufacturing/boms`                             | `manufacturing.boms.view`            | List BOMs with search/filtering   |
| `GET`    | `/api/v1/manufacturing/boms/:id`                         | `manufacturing.boms.view`            | Get single BOM details            |
| `PATCH`  | `/api/v1/manufacturing/boms/:id`                         | `manufacturing.boms.manage`          | Update draft BOM                  |
| `DELETE` | `/api/v1/manufacturing/boms/:id`                         | `manufacturing.boms.manage`          | Delete draft BOM                  |
| `POST`   | `/api/v1/manufacturing/boms/:id/activate`                | `manufacturing.boms.activate`        | Activate BOM version              |
| `POST`   | `/api/v1/manufacturing/boms/:id/deactivate`              | `manufacturing.boms.activate`        | Deactivate BOM                    |
| `POST`   | `/api/v1/manufacturing/orders`                           | `manufacturing.orders.manage`        | Create draft production order     |
| `GET`    | `/api/v1/manufacturing/orders`                           | `manufacturing.orders.view`          | List production orders            |
| `GET`    | `/api/v1/manufacturing/orders/:id`                       | `manufacturing.orders.view`          | Get single order details          |
| `PATCH`  | `/api/v1/manufacturing/orders/:id`                       | `manufacturing.orders.manage`        | Update draft order                |
| `DELETE` | `/api/v1/manufacturing/orders/:id`                       | `manufacturing.orders.manage`        | Delete draft order                |
| `GET`    | `/api/v1/manufacturing/orders/:id/material-availability` | `manufacturing.planning.view`        | Check material shortage           |
| `POST`   | `/api/v1/manufacturing/orders/:id/release`               | `manufacturing.orders.release`       | Release order to shop floor       |
| `POST`   | `/api/v1/manufacturing/orders/:id/start`                 | `manufacturing.orders.start`         | Start order execution             |
| `POST`   | `/api/v1/manufacturing/orders/:id/issue-material`        | `manufacturing.orders.issue`         | Issue components & record WIP     |
| `POST`   | `/api/v1/manufacturing/orders/:id/complete`              | `manufacturing.orders.complete`      | Finished goods receipt & GL       |
| `POST`   | `/api/v1/manufacturing/orders/:id/cancel`                | `manufacturing.orders.cancel`        | Cancel draft/released order       |
| `POST`   | `/api/v1/manufacturing/orders/:id/close`                 | `manufacturing.orders.close`         | Close order & post variance       |
| `GET`    | `/api/v1/manufacturing/configuration`                    | `manufacturing.configuration.manage` | Get tenant manufacturing settings |
| `PATCH`  | `/api/v1/manufacturing/configuration`                    | `manufacturing.configuration.manage` | Update GL mappings & policies     |
| `GET`    | `/api/v1/manufacturing/reports/production-summary`       | `manufacturing.reports.view`         | Production summary report         |
| `GET`    | `/api/v1/manufacturing/reports/material-consumption`     | `manufacturing.reports.view`         | Component consumption report      |
| `GET`    | `/api/v1/manufacturing/reports/production-cost`          | `manufacturing.costing.view`         | Production costing report         |
| `GET`    | `/api/v1/manufacturing/reports/wip`                      | `manufacturing.costing.view`         | Active WIP valuation report       |
| `GET`    | `/api/v1/manufacturing/reports/production-variance`      | `manufacturing.costing.view`         | Production variance report        |
