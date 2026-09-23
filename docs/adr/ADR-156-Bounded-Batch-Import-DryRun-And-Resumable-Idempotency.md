# ADR-156: Bounded Batch Import, Dry-Run Preview, and Resumable Idempotency

## Status

Accepted

## Context

Bulk data ingestion can destabilize production systems through unvalidated inputs, uncontrolled concurrency, database lock contention, and non-atomic partial failures. Operators require the ability to validate files, preview transformations, detect duplicate conflicts, and safely resume interrupted jobs without duplicating database records.

## Decision

1. **Non-Mutating Dry-Run Preview**: `DataImportService.preview` validates file structure, tests declarative transformations, checks identity constraints against current tenant database records, and returns validation errors, duplicate counts, and transformed sample rows without executing any persistent mutations (INV-536).
2. **Pre-Commit Revalidation**: Prior to committing mutations, `DataImportService.commit` re-evaluates caller permissions, verifies active tenant context, and verifies that the authoritative operation definition is active (INV-543).
3. **Declarative Transformations Only**: Import fields are sanitized and transformed using declaratively registered transformations (`trim`, `toLowerCase`, `toUpperCase`, `toCents`, `toInteger`, `normalizePhone`, `booleanString`). Dynamic or arbitrary user code execution is strictly prohibited (INV-537).
4. **Authoritative Duplicate Resolution**: Identity fields (e.g. `email` for customer, `sku` for item) and duplicate strategies (`FAIL`, `SKIP`, `UPDATE`) are governed strictly by the authoritative operation definition, never by client input (INV-538).
5. **Bounded Batch Execution**: Imports are partitioned into fixed batch chunks (default 250 rows, max 1,000 rows). Database mutations are performed within transactional batch boundaries (`prisma.$transaction`), ensuring atomic commit per batch (INV-540, INV-545).
6. **Resumable Idempotency**: `DataOperationBatch` records the completion status and batch index of each batch. When a job is retried or resumed, `DataImportService` inspects `completedBatches` and skips already committed batches, preventing duplicate mutations (INV-539).

## Consequences

### Positive

- Zero unintended database mutations during preview or verification.
- Safe retries of interrupted or network-severed bulk ingestion jobs.
- Bounded database transaction times and minimal lock contention.

## Related Invariants

- `INV-529`: Import Tenant Mutation Boundary
- `INV-536`: Non-Mutating Import Preview
- `INV-537`: Declarative Transformation Enforcement
- `INV-538`: Authoritative Identity & Duplicate Resolution
- `INV-539`: Resumable Idempotency Without Duplication
- `INV-540`: Bounded Concurrency & Batch Sizing
- `INV-543`: Pre-Commit Revalidation
- `INV-545`: Transactional Cancellation Boundary
