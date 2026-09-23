# Milestone M19 — Inventory Valuation, Costing & COGS Accounting Specification

## 1. Executive Summary

Milestone **M19 — Inventory Valuation, Costing & COGS Accounting Foundation** establishes an institutional-grade, multi-tenant inventory valuation and financial costing engine for the Universal SaaS platform. It connects physical stock movements from M09 Inventory, M10 Purchasing, M11 Sales, and M18 Credit/Debit Notes to the M12 General Ledger with exact Decimal precision.

---

## 2. Core Capabilities

### 2.1 Valuation & Costing Engine

- **Weighted Average Cost (WAC)**: Primary active costing method with transactional dynamic recalculation.
  $$\text{New Average Cost} = \frac{(\text{Current Qty} \times \text{Current Avg Cost}) + (\text{Incoming Qty} \times \text{Incoming Unit Cost})}{\text{Current Qty} + \text{Incoming Qty}}$$
- **FIFO-Ready Cost Layers**: Inbound movements create granular `InventoryCostLayer` records tracking original receipt quantities, unit costs, remaining quantities, and consumed quantities.
- **Location-Aware Valuation**: Valuation maintained per `(organizationId, itemId, variantId, locationId)`.

### 2.2 Cost of Goods Sold (COGS) & General Ledger Integration

- **Sales Delivery / Outbound Issue**:
  - Calculates COGS using the current weighted average cost at time of issue.
  - Creates immutable `CostOfGoodsSoldRecord`.
  - Generates balanced General Ledger `JournalEntry`:
    $$\text{Debit: COGS}, \quad \text{Credit: INVENTORY\_ASSET}$$
- **Purchasing / Goods Receipts**:
  - Records new cost layer and updates WAC.
  - Generates balanced GL `JournalEntry`:
    $$\text{Debit: INVENTORY\_ASSET}, \quad \text{Credit: PURCHASE\_CLEARING (or ACCOUNTS\_PAYABLE)}$$
- **Inventory Adjustments**:
  - Positive Adjustment (`ADJUSTMENT_IN`):
    $$\text{Debit: INVENTORY\_ASSET}, \quad \text{Credit: INVENTORY\_ADJUSTMENT\_GAIN}$$
  - Negative Adjustment (`ADJUSTMENT_OUT`):
    $$\text{Debit: INVENTORY\_ADJUSTMENT\_LOSS}, \quad \text{Credit: INVENTORY\_ASSET}$$
- **Customer Return Restock**:
  - Reclassifies / restores inventory asset:
    $$\text{Debit: INVENTORY\_ASSET}, \quad \text{Credit: COGS}$$

---

## 3. Database Schema Models

- `InventoryCostLayer`: Append-only FIFO cost layer tracking.
- `InventoryValuation`: Location-specific current quantity, average cost, and total value snapshot.
- `CostOfGoodsSoldRecord`: Immutable COGS audit ledger linked to stock movements, delivery orders, and GL journal entries.

---

## 4. API Endpoints

- `GET /api/v1/inventory/valuation` (`inventory.valuation.view`)
- `GET /api/v1/inventory/costing/items/:itemId/history` (`inventory.costing.view`)
- `GET /api/v1/inventory/costing/cogs` (`inventory.cogs.view`)
- `POST /api/v1/inventory/costing/receipt` (`inventory.costing.manage`)
- `POST /api/v1/inventory/costing/issue-cogs` (`inventory.costing.manage`)
- `POST /api/v1/inventory/costing/adjustment` (`inventory.costing.manage`)
- `POST /api/v1/inventory/costing/return-restock` (`inventory.costing.manage`)
