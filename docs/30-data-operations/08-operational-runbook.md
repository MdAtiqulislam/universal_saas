# Data Operations Platform Operational Runbook

## Overview

This runbook outlines operational procedures, troubleshooting workflows, failure recovery steps, and telemetry monitoring for the Data Operations platform.

---

## Standard Operating Procedures

### 1. Registering a New Domain Data Operation

To add export/import support for a new business entity:

1. Ensure the entity model includes `organizationId` and proper Prisma relation indices.
2. Define the canonical operation key following `<domain>.<entity>.<action>`.
3. Open `apps/api/src/data-operations/registry/data-operation.registry.ts`.
4. Add the definition inside `registerAuthoritativeOperations()`:
   - Specify `requiredPermissions`.
   - List allowlisted fields in `fieldAllowlist`.
   - Specify `restrictedFields` if any sensitive attributes exist.
   - Define `identityFields` (e.g. `code`, `slug`, `email`) for duplicate detection.
   - Declare declarative transformations.
5. Implement or bind the domain handler in `DataExportService` / `DataImportService`.
6. Add unit test assertions in `data-operation-registry.spec.ts`.

### 2. Monitoring High-Volume Bulk Jobs

- **Job Status Queries**: Query `/api/v1/data-operations/jobs?status=PROCESSING`.
- **Worker Concurrency**: Ensure active concurrent jobs per tenant does not exceed `maxConcurrentJobs` (default: 3).
- **Error Spikes**: Inspect `DataOperationError` table filtered by `jobId` to identify schema mismatches or invalid customer data formats.

---

## Failure Recovery & Incident Response

### Issue: Import Job Stalled in `PROCESSING`

**Root Cause**: Node.js worker killed abruptly (OOM or cluster deployment) during batch execution.
**Remediation**:

1. Check M36 `JobService` status for the underlying background task.
2. The `DataOperationBatch` records store exact completed batch indices.
3. Trigger job resume via `POST /api/v1/data-operations/jobs/{id}/retry`.
4. The engine will skip all `COMPLETED` batches and resume uncommitted batches without duplicating rows (INV-539).

### Issue: User Reports CSV Formula Warning in Excel

**Root Cause**: Input contained characters like `=`, `+`, `-`, or `@`.
**Expected Behavior**: In M46, `FileSecurityUtil` automatically prepends `'` to neutralize formula execution.
**Verification**: Open the raw CSV in a text editor to confirm the leading `'` was injected. Verify that Excel treats the value as a plain text string.
