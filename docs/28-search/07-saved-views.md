# 07 — Saved Views Architecture

## Model Overview

The `SavedView` model persists user preferences for repeated search discovery:

- `name`: Human-readable label (unique per user/tenant)
- `resourceType`: Target business model (e.g. `Customer`, `SalesOrder`)
- `scope`: SearchScope enum
- `visibility`: `PERSONAL`, `SHARED`, `TENANT`
- `queryText`: Optional pre-filled query string
- `filters`: Stored AST `FilterNode`
- `visibleFields`: Array of column names to display
- `sortField`, `sortOrder`: Pre-configured sorting preferences

## Invariant Guarantees

- **INV-477**: Saved view belongs to exactly one tenant organization (`organizationId`).
- **INV-491**: Personal saved views are accessible solely by their owner user. Non-owners receive `ForbiddenException`.
- **INV-493**: Saved view filter AST configurations are validated on save/update against permitted field allowlists and operators.
- **INV-494**: Executing a saved view respects underlying domain permissions. Having access to a shared saved view does not grant unauthorized access to confidential records.
