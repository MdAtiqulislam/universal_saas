# M07 — Master Data & Configuration Management Architecture Guide

This document defines the master data architecture, global reference data, hierarchical tenant locations, tax configurations, and atomic sequence generation established in **Milestone M07**.

---

## 1. Master Data Classification

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MASTER DATA ARCHITECTURE                        │
├───────────────────────────────────┬────────────────────────────────────┤
│      GLOBAL REFERENCE DATA        │      TENANT-OWNED MASTER DATA      │
│  (Platform-wide, shared catalog)  │  (Strictly isolated per tenant)    │
├───────────────────────────────────┼────────────────────────────────────┤
│  • Currencies (ISO-4217)          │  • Locations (Branches/Warehouses) │
│    e.g. USD, EUR, BDT, INR        │  • Tax Rates (VAT/GST/Sales Tax)   │
│                                   │  • Numbering Sequences (INV, SO)   │
│                                   │  • Organization Settings           │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 2. Master Data Entities & Endpoints

### 2.1 Global Currencies (`/api/v1/currencies`)

- Global reference catalog of ISO-4217 currencies.
- Permissions: `master-data.currencies.view`, `master-data.currencies.manage`.

| Endpoint                 | Method   | Permission                      | Description                               |
| :----------------------- | :------- | :------------------------------ | :---------------------------------------- |
| `/api/v1/currencies`     | `GET`    | `master-data.currencies.view`   | List currencies (filter by active/search) |
| `/api/v1/currencies/:id` | `GET`    | `master-data.currencies.view`   | Get currency by ID                        |
| `/api/v1/currencies`     | `POST`   | `master-data.currencies.manage` | Create new global currency                |
| `/api/v1/currencies/:id` | `PATCH`  | `master-data.currencies.manage` | Update currency attributes                |
| `/api/v1/currencies/:id` | `DELETE` | `master-data.currencies.manage` | Deactivate currency                       |

### 2.2 Hierarchical Locations (`/api/v1/locations`)

- Tenant-scoped locations (Head Office, Branch, Warehouse, Store, Factory, Other).
- Supports parent-child tree structure with cross-tenant parent prevention.
- Permissions: `master-data.locations.view`, `master-data.locations.manage`.

| Endpoint                | Method   | Permission                     | Description               |
| :---------------------- | :------- | :----------------------------- | :------------------------ |
| `/api/v1/locations`     | `GET`    | `master-data.locations.view`   | List tenant locations     |
| `/api/v1/locations/:id` | `GET`    | `master-data.locations.view`   | Get tenant location by ID |
| `/api/v1/locations`     | `POST`   | `master-data.locations.manage` | Create location           |
| `/api/v1/locations/:id` | `PATCH`  | `master-data.locations.manage` | Update location           |
| `/api/v1/locations/:id` | `DELETE` | `master-data.locations.manage` | Soft-delete location      |

### 2.3 Tax Rates (`/api/v1/taxes`)

- High-precision `DECIMAL(12, 4)` tax rates (VAT, GST, Sales Tax).
- Permissions: `master-data.taxes.view`, `master-data.taxes.manage`.

| Endpoint            | Method   | Permission                 | Description           |
| :------------------ | :------- | :------------------------- | :-------------------- |
| `/api/v1/taxes`     | `GET`    | `master-data.taxes.view`   | List tenant tax rates |
| `/api/v1/taxes/:id` | `GET`    | `master-data.taxes.view`   | Get tax rate by ID    |
| `/api/v1/taxes`     | `POST`   | `master-data.taxes.manage` | Create tax rate       |
| `/api/v1/taxes/:id` | `PATCH`  | `master-data.taxes.manage` | Update tax rate       |
| `/api/v1/taxes/:id` | `DELETE` | `master-data.taxes.manage` | Archive tax rate      |

### 2.4 Numbering Sequences (`/api/v1/numbering-sequences`)

- Configurable auto-increment counters with prefix and padding (e.g. `INVOICE` -> `INV-000042`).
- Atomic concurrency-safe allocation via PostgreSQL row locking.
- Permissions: `master-data.numbering.view`, `master-data.numbering.manage`, `master-data.numbering.generate`.

| Endpoint                                | Method  | Permission                       | Description                              |
| :-------------------------------------- | :------ | :------------------------------- | :--------------------------------------- |
| `/api/v1/numbering-sequences`           | `GET`   | `master-data.numbering.view`     | List numbering sequences                 |
| `/api/v1/numbering-sequences/:id`       | `GET`   | `master-data.numbering.view`     | Get sequence by ID                       |
| `/api/v1/numbering-sequences`           | `POST`  | `master-data.numbering.manage`   | Create numbering sequence                |
| `/api/v1/numbering-sequences/:id`       | `PATCH` | `master-data.numbering.manage`   | Update sequence                          |
| `/api/v1/numbering-sequences/:key/next` | `POST`  | `master-data.numbering.generate` | Atomically generate next sequence number |

---

## 3. Concurrency-Safe Sequence Generation Design

`NumberingService.nextNumber()` executes an atomic PostgreSQL single-statement query:

```sql
UPDATE numbering_sequences
SET next_number = next_number + 1, updated_at = NOW()
WHERE organization_id = $1::uuid
  AND key = $2
  AND is_active = true
RETURNING (next_number - 1) AS allocated_number, prefix, padding;
```

This guarantees:

1. **Zero Duplicate Numbers:** Row lock prevents race conditions under high concurrent volume.
2. **Deterministic Formatting:** Formats output with configured prefix and zero-padding.

---

## 4. Audit & Event Integration

All master data mutations emit domain events to the internal `EventBusService`:

- `CURRENCY_CREATED`, `CURRENCY_UPDATED`, `CURRENCY_DEACTIVATED`
- `LOCATION_CREATED`, `LOCATION_UPDATED`, `LOCATION_ARCHIVED`
- `TAX_CREATED`, `TAX_UPDATED`, `TAX_ARCHIVED`
- `NUMBERING_SEQUENCE_CREATED`, `NUMBERING_SEQUENCE_UPDATED`, `NUMBERING_SEQUENCE_GENERATED`
