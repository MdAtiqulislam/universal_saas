# 03 — Domain Provider Architecture

## SearchProvider Interface

Every domain search provider implements the standard `SearchProvider` contract:

```typescript
export interface SearchProvider {
  readonly scope: SearchScope;
  readonly resourceType: string;
  readonly requiredPermission: string;

  search(params: ProviderSearchParams): Promise<SearchRecord[]>;
  getSuggestions(params: ProviderSuggestionParams): Promise<SuggestionItem[]>;
}
```

## Active Domain Providers

| Provider                     | Scope           | Resource Type          | Authoritative Model           | Required Permission        |
| :--------------------------- | :-------------- | :--------------------- | :---------------------------- | :------------------------- |
| `CustomerSearchProvider`     | `CRM`           | `Customer`             | `prisma.customer`             | `crm.customers.read`       |
| `SalesSearchProvider`        | `SALES`         | `SalesOrder`           | `prisma.salesOrder`           | `sales.orders.read`        |
| `InventorySearchProvider`    | `INVENTORY`     | `Item`                 | `prisma.item`                 | `inventory.items.read`     |
| `WarehouseSearchProvider`    | `WAREHOUSE`     | `Location`             | `prisma.location`             | `warehouse.locations.read` |
| `QualitySearchProvider`      | `QUALITY`       | `QualityInspectionLot` | `prisma.qualityInspectionLot` | `quality.inspections.read` |
| `ReturnsSearchProvider`      | `RETURNS`       | `ReturnRequest`        | `prisma.returnRequest`        | `returns.requests.read`    |
| `ServiceSearchProvider`      | `SERVICE`       | `ServiceTicket`        | `prisma.serviceTicket`        | `service.tickets.read`     |
| `FinanceSearchProvider`      | `FINANCE`       | `CustomerInvoice`      | `prisma.customerInvoice`      | `finance.invoices.read`    |
| `WorkflowSearchProvider`     | `WORKFLOWS`     | `WorkflowDefinition`   | `prisma.workflowDefinition`   | `workflows.read`           |
| `NotificationSearchProvider` | `NOTIFICATIONS` | `Notification`         | `prisma.notification`         | `notifications.read`       |
| `UserSearchProvider`         | `USERS`         | `User`                 | `prisma.organizationMember`   | `users.read`               |

## Result Normalization

All providers normalize raw database rows into a common `SearchRecord`:

- `id`: Authoritative entity primary key or business reference code
- `scope`: Domain scope enum
- `resourceType`: PascalCase entity name
- `title`: Primary human-readable title
- `subtitle`: Contextual secondary metadata (e.g. status, amounts, SKU)
- `description`: Text excerpt matching query
- `url`: Direct deep link to UI view route
- `createdAt`, `updatedAt`: ISO timestamps
