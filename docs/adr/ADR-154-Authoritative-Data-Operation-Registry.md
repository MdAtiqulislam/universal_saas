# ADR-154: Authoritative Data Operation Registry

## Status

Accepted

## Context

Enterprise data export and import historically suffers from domain-level fragmentation, where each domain builds custom CSV parsers, ad-hoc serializers, unvalidated SQL queries, and divergent permission checks. To enforce strict platform governance, zero arbitrary SQL, and unified schema validation across all domains, a centralized registry pattern is required.

## Decision

1. **Centralized In-Memory Registry**: `DataOperationRegistry` serves as the single source of truth for all supported data operations across all business domains.
2. **Authoritative Operation Keys**: Operations are registered with globally unique keys following the naming standard `<domain>.<entity>.<action>` (e.g. `crm.customer.export`, `inventory.item.import`). Duplicate key registrations throw `ConflictException` (INV-526).
3. **Field Allowlists & Strict Selection**: Every operation declares explicit allowlists of exportable and importable fields. Incoming requests cannot select fields outside the allowlist, preventing unintended internal state exposure (INV-531, INV-532).
4. **Restricted Field Governance**: Sensitive fields (e.g. `creditLimitCents`, `unitCostCents`) are designated as restricted. They are excluded from default export operations and require elevated permissions (`data_operations.restricted_fields.export` or `data_operations.admin`) to query (INV-533).
5. **Zero Dynamic Code or SQL**: Operations declare strongly typed query handlers or mapping specifications; arbitrary SQL text and dynamic query execution are strictly rejected (INV-534).

## Consequences

### Positive

- Complete auditability and consistency across all platform data movements.
- Elimination of domain-specific CSV engine duplication.
- Strong compile-time and runtime guarantees against field leakage.

## Related Invariants

- `INV-526`: Authoritative Operation Key Uniqueness
- `INV-530`: Authoritative Permission Enforcement
- `INV-531`: Export Field Allowlist Enforcement
- `INV-532`: Import Field Allowlist Enforcement
- `INV-533`: Restricted Field Export Protection
- `INV-534`: Zero Arbitrary SQL or Dynamic Code
