# Public API Contracts & Endpoints Reference

## Overview

The Data Operations platform exposes internal endpoints (for web UI and microservices) and public REST endpoints (for developer integrations) under complete contract parity (INV-549).

---

## Internal Controller Endpoints (`DataOperationsController`)

Prefix: `/api/v1/data-operations` (Guards: `JwtAuthGuard`, `PermissionGuard`)

| Method | Endpoint                    | Permission                         | Description                              |
| :----- | :-------------------------- | :--------------------------------- | :--------------------------------------- |
| `GET`  | `/operations`               | `data_operations.operations.view`  | List authoritative operation definitions |
| `GET`  | `/operations/:operationKey` | `data_operations.operations.view`  | Get specific operation definition        |
| `POST` | `/export`                   | `data_operations.export.execute`   | Execute synchronous or async data export |
| `POST` | `/import/preview`           | `data_operations.import.preview`   | Execute non-mutating dry-run preview     |
| `POST` | `/import/commit`            | `data_operations.import.execute`   | Commit bulk import data                  |
| `GET`  | `/jobs`                     | `data_operations.jobs.view`        | List tenant data operation jobs          |
| `GET`  | `/jobs/:id`                 | `data_operations.jobs.view`        | Get specific job status and statistics   |
| `POST` | `/jobs/:id/cancel`          | `data_operations.jobs.cancel`      | Cancel active data operation job         |
| `GET`  | `/jobs/:id/download`        | `data_operations.jobs.view`        | Download export result file              |
| `GET`  | `/jobs/:id/errors`          | `data_operations.jobs.view`        | Download import error report CSV         |
| `POST` | `/templates`                | `data_operations.templates.manage` | Save reusable field mapping template     |
| `GET`  | `/templates`                | `data_operations.operations.view`  | List reusable field mapping templates    |

---

## Public Developer API Contracts (`ApiContractService`)

Public endpoints under `/api/v1/data-operations/...` conform to OpenAPI 3.0 specification:

1. **`POST /api/v1/data-operations/export`**:
   - Executes authorized export for external API callers.
   - Enforces M42 rate limits and caller tenant boundary.
2. **`POST /api/v1/data-operations/import/preview`**:
   - Returns validation metrics and duplicate counts for external ingestion files.
3. **`POST /api/v1/data-operations/import/commit`**:
   - Triggers idempotent batch execution.
4. **`GET /api/v1/data-operations/jobs/{id}`**:
   - Queries job lifecycle status, processed rows, and completion timestamps.
