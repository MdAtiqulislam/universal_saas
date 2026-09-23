# Authoritative Data Operation Registry

## Overview

The `DataOperationRegistry` is the authoritative catalog of all data export and import operations across the platform. Located at `apps/api/src/data-operations/registry/data-operation.registry.ts`, it acts as the strict governance boundary defining which entities can be exported or imported, what fields may be accessed, who is authorized, and what business rules apply.

---

## Authoritative Registration Standard

Operations are registered at module bootstrap using the interface `DataOperationDefinition`:

```typescript
export interface DataOperationDefinition {
  operationKey: string; // Standard: <domain>.<entity>.<action>
  type: DataOperationType; // EXPORT | IMPORT
  domain: string; // e.g. 'crm', 'inventory', 'sales'
  entityName: string; // e.g. 'customer', 'item', 'order'
  displayName: string;
  description?: string;
  requiredPermissions: string[]; // Required caller permissions
  fieldAllowlist: DataOperationField[];
  restrictedFields?: string[]; // Fields requiring elevated permission
  restrictedFieldPermission?: string; // Default: 'data_operations.restricted_fields.export'
  identityFields?: string[]; // Fields used for duplicate detection (imports)
  supportedModes?: DataImportMode[]; // [CREATE_ONLY, UPDATE_ONLY, UPSERT]
  supportedStrategies?: DataDuplicateStrategy[]; // [FAIL, SKIP, UPDATE]
  transformations?: Record<string, string[]>; // Field -> transformations
  maxBatchSize?: number; // Default: 1000
  maxRows?: number; // Operation row limit
}
```

---

## Canonical Registered Operations

The platform initializes with 8 core authoritative operations:

| Operation Key            | Type   | Domain    | Entity   | Required Permissions                                         | Identity Fields |
| :----------------------- | :----- | :-------- | :------- | :----------------------------------------------------------- | :-------------- |
| `crm.customer.export`    | EXPORT | crm       | customer | `crm.customers.view`, `data_operations.export.execute`       | -               |
| `crm.customer.import`    | IMPORT | crm       | customer | `crm.customers.manage`, `data_operations.import.execute`     | `email`         |
| `inventory.item.export`  | EXPORT | inventory | item     | `inventory.items.view`, `data_operations.export.execute`     | -               |
| `inventory.item.import`  | IMPORT | inventory | item     | `inventory.items.manage`, `data_operations.import.execute`   | `sku`           |
| `sales.order.export`     | EXPORT | sales     | order    | `sales.orders.view`, `data_operations.export.execute`        | -               |
| `catalog.item.export`    | EXPORT | catalog   | item     | `catalog.items.view`, `data_operations.export.execute`       | -               |
| `catalog.item.import`    | IMPORT | catalog   | item     | `catalog.items.manage`, `data_operations.import.execute`     | `sku`           |
| `finance.invoice.export` | EXPORT | finance   | invoice  | `accounting.invoices.view`, `data_operations.export.execute` | -               |

---

## Invariant Enforcement Mechanisms

### INV-526: Authoritative Operation Key Uniqueness

- The registry maintains a private `Map<string, DataOperationDefinition>`.
- Any attempt to register an existing key throws `ConflictException("Data operation key '<key>' is already registered")`.

### INV-531 & INV-532: Field Allowlists

- `validateFieldSelection(def, requestedFields)` checks each requested field against `def.fieldAllowlist`.
- Attempting to query or map unallowlisted fields immediately throws `BadRequestException`.

### INV-533: Restricted Field Protection

- `assertFieldPermissions(def, fields, userPermissions)` identifies whether any restricted fields are selected.
- If selected and caller lacks `restrictedFieldPermission` or `data_operations.admin`, it throws `ForbiddenException`.
