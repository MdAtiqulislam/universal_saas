# M08 — Item & Product Catalog Architecture Guide

This document defines the product catalog architecture, categories, units of measure, items, variants, pricing tiers, and multi-tenant catalog isolation rules established in **Milestone M08**.

---

## 1. Catalog Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ITEM & PRODUCT CATALOG                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│            TAXONOMY & UOM            │            PRODUCT MASTER            │
├──────────────────────────────────────┼──────────────────────────────────────┤
│  • Categories (hierarchical tree)    │  • Item (Base SKU, Type, Tracking)   │
│  • Units of Measure (PCS, KG, LTR)   │  • Item Variant (Color/Size combos)  │
│                                      │  • Pricing Tiers & Item/Variant Price│
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Catalog Models & Relational Structure

### 2.1 Category (`categories`)

- Scoped to `organization_id`.
- Hierarchical self-relation (`parent_id`) with `onDelete: SetNull`.
- Self-parenting loops and cross-tenant parent assignments are blocked at service level.
- Code uniqueness: `UNIQUE(organization_id, code)`.

### 2.2 Unit of Measure (`units_of_measure`)

- Scoped to `organization_id`.
- Code normalized to uppercase (e.g. `PCS`, `KG`, `BOX`).
- Configurable decimal places (0 to 6).
- Deactivation preferred over deletion to preserve historical references.

### 2.3 Item (`items`)

- Central item definition.
- Fields: `sku`, `name`, `description`, `categoryId`, `unitId`, `itemType`, `trackingType`, `isActive`, `deletedAt`.
- Enums:
  - `ItemType`: `PRODUCT`, `SERVICE`, `DIGITAL`
  - `TrackingType`: `NONE`, `BATCH`, `SERIAL`
- SKU uniqueness: `UNIQUE(organization_id, sku)`.

### 2.4 Item Variant (`item_variants`)

- Permutations of parent items (e.g. Size, Color).
- Links to parent `Item` with `onDelete: Cascade`.
- JSONB `attributes` column (e.g. `{ "size": "XL", "color": "Navy" }`).
- SKU uniqueness: `UNIQUE(organization_id, sku)`.

### 2.5 Pricing Tiers & Prices (`pricing_tiers`, `item_prices`)

- `PricingTier`: Defines customer/channel pricing tiers (`RETAIL`, `WHOLESALE`, `VIP`) linked to global ISO currency.
- `ItemPrice`: Stores `DECIMAL(18, 4)` amounts and minimum quantities.
- Strict XOR Constraint: Must target _either_ `itemId` OR `variantId`, never both and never neither. Enforced at PostgreSQL DDL constraint level.

---

## 3. Catalog REST API Endpoints

| Resource       | Method   | Path                                         | Permission                  | Description                             |
| :------------- | :------- | :------------------------------------------- | :-------------------------- | :-------------------------------------- |
| **Categories** | `GET`    | `/api/v1/catalog/categories`                 | `catalog.categories.view`   | List categories (active/search filters) |
|                | `GET`    | `/api/v1/catalog/categories/:id`             | `catalog.categories.view`   | Get category by ID                      |
|                | `POST`   | `/api/v1/catalog/categories`                 | `catalog.categories.manage` | Create category                         |
|                | `PATCH`  | `/api/v1/catalog/categories/:id`             | `catalog.categories.manage` | Update category                         |
|                | `DELETE` | `/api/v1/catalog/categories/:id`             | `catalog.categories.manage` | Soft-delete category                    |
| **Units**      | `GET`    | `/api/v1/catalog/units`                      | `catalog.units.view`        | List units of measure                   |
|                | `GET`    | `/api/v1/catalog/units/:id`                  | `catalog.units.view`        | Get unit by ID                          |
|                | `POST`   | `/api/v1/catalog/units`                      | `catalog.units.manage`      | Create unit                             |
|                | `PATCH`  | `/api/v1/catalog/units/:id`                  | `catalog.units.manage`      | Update unit                             |
|                | `DELETE` | `/api/v1/catalog/units/:id`                  | `catalog.units.manage`      | Deactivate unit                         |
| **Items**      | `GET`    | `/api/v1/catalog/items`                      | `catalog.items.view`        | List items (paginated & filtered)       |
|                | `GET`    | `/api/v1/catalog/items/:id`                  | `catalog.items.view`        | Get item with full relations            |
|                | `POST`   | `/api/v1/catalog/items`                      | `catalog.items.manage`      | Create item                             |
|                | `PATCH`  | `/api/v1/catalog/items/:id`                  | `catalog.items.manage`      | Update item                             |
|                | `DELETE` | `/api/v1/catalog/items/:id`                  | `catalog.items.manage`      | Soft-delete item and variants           |
| **Variants**   | `GET`    | `/api/v1/catalog/items/:itemId/variants`     | `catalog.variants.view`     | List variants of an item                |
|                | `GET`    | `/api/v1/catalog/variants/:id`               | `catalog.variants.view`     | Get variant by ID                       |
|                | `POST`   | `/api/v1/catalog/items/:itemId/variants`     | `catalog.variants.manage`   | Create variant                          |
|                | `PATCH`  | `/api/v1/catalog/variants/:id`               | `catalog.variants.manage`   | Update variant                          |
|                | `DELETE` | `/api/v1/catalog/variants/:id`               | `catalog.variants.manage`   | Soft-delete variant                     |
| **Pricing**    | `GET`    | `/api/v1/catalog/pricing-tiers`              | `catalog.pricing.view`      | List pricing tiers                      |
|                | `GET`    | `/api/v1/catalog/pricing-tiers/:id`          | `catalog.pricing.view`      | Get pricing tier by ID                  |
|                | `POST`   | `/api/v1/catalog/pricing-tiers`              | `catalog.pricing.manage`    | Create pricing tier                     |
|                | `PATCH`  | `/api/v1/catalog/pricing-tiers/:id`          | `catalog.pricing.manage`    | Update pricing tier                     |
|                | `GET`    | `/api/v1/catalog/items/:itemId/prices`       | `catalog.pricing.view`      | List prices for item                    |
|                | `POST`   | `/api/v1/catalog/items/:itemId/prices`       | `catalog.pricing.manage`    | Create item price                       |
|                | `GET`    | `/api/v1/catalog/variants/:variantId/prices` | `catalog.pricing.view`      | List prices for variant                 |
|                | `POST`   | `/api/v1/catalog/variants/:variantId/prices` | `catalog.pricing.manage`    | Create variant price                    |
|                | `PATCH`  | `/api/v1/catalog/prices/:id`                 | `catalog.pricing.manage`    | Update price amount/qty                 |
|                | `DELETE` | `/api/v1/catalog/prices/:id`                 | `catalog.pricing.manage`    | Delete price entry                      |

---

## 4. Audit & Event Integration

All catalog operations publish events to the internal `EventBusService`:

- `CATEGORY_CREATED`, `CATEGORY_UPDATED`, `CATEGORY_ARCHIVED`
- `UNIT_CREATED`, `UNIT_UPDATED`, `UNIT_DEACTIVATED`
- `ITEM_CREATED`, `ITEM_UPDATED`, `ITEM_ARCHIVED`
- `VARIANT_CREATED`, `VARIANT_UPDATED`, `VARIANT_ARCHIVED`
- `PRICING_TIER_CREATED`, `PRICING_TIER_UPDATED`
- `PRICE_CREATED`, `PRICE_UPDATED`, `PRICE_DELETED`
