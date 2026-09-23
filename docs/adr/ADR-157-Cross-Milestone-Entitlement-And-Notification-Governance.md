# ADR-157: Cross-Milestone Entitlement and Notification Governance

## Status

Accepted

## Context

Data operations are resource-intensive platform capabilities requiring strict multi-tenant governance. Without integration with cross-platform foundational services, large exports or imports could bypass billing tier limits, swamp background workers, or fail silently without user visibility.

## Decision

1. **M42 Entitlements Integration**: `DataOperationQuotaService` interfaces with M42 `EntitlementsService` to enforce tenant quota limits before job creation:
   - Monthly export operations limit (`data_operations.monthly_exports`).
   - Monthly import operations limit (`data_operations.monthly_imports`).
   - Maximum allowed rows per operation (`data_operations.max_rows_per_operation`).
   - Maximum active concurrent bulk operations per tenant (`data_operations.max_concurrent_jobs`) (INV-546).
2. **M43 Notifications Integration**: `DataOperationNotificationService` integrates with M43 `NotificationsService` to deliver omnichannel alerts (email, in-app) upon job completion or terminal failure, strictly respecting recipient timezone, quiet hours, and channel preferences (INV-547).
3. **M40 Workflow Action Extensions**: Workflow engine catalog registers `start_export` and `start_import` actions, allowing automated triggers within tenant workflows.
4. **M41 Public API Parity**: Public REST endpoints (`/api/v1/data-operations/...`) inherit identical validation, authorization, quota, and idempotency guarantees as internal platform operations (INV-549).
5. **M38 Observability & Audit**: All mutations and access events are recorded via M38 `AuditService` with sanitized payloads, ensuring no sensitive credentials or restricted business data leak into telemetry or logs (INV-548, INV-550).

## Consequences

### Positive

- Unified billing tier enforcement preventing resource monopolization.
- Consistent user communication adhering to platform-wide notification preferences.
- Standardized public API surface fully governed by platform security policies.

## Related Invariants

- `INV-541`: Tenant-Scoped Job Access
- `INV-546`: Quota Enforcement via M42 Entitlements
- `INV-547`: Notification Delivery via M43 Policies
- `INV-548`: Administrative Auditing & Permissions
- `INV-549`: Public API Contract Parity
- `INV-550`: Sanitized Telemetry & History
