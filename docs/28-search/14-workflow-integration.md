# 14 — Automated Workflow Integration (M40)

## Registered Workflow Actions

M44 registers two enterprise workflow actions with `ActionCatalogService` and `WorkflowActionExecutorService`:

### 1. `search_records`

- **Action Type**: `search_records`
- **Category**: `SEARCH`
- **Description**: Search for platform records across modules using unified search.
- **Parameters**: `query` (string), `scope` (string, optional), `limit` (number, optional, max 50).
- **Output**: Returns array of `SearchRecord` objects and total match count into workflow context.

### 2. `evaluate_search_alert`

- **Action Type**: `evaluate_search_alert`
- **Category**: `SEARCH`
- **Description**: Trigger an immediate evaluation of a configured search alert.
- **Parameters**: `alertId` (string, required).
- **Output**: Returns evaluation status, match count, and execution ID.
