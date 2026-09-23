# Bulk Idempotency & Resumable Execution Architecture

## Overview

Bulk imports of 10,000 to 50,000 records are vulnerable to network interruption, worker restart, database failover, or transient rate limits. The Data Operations platform guarantees **resumable idempotency** (INV-539): retrying an interrupted import skips all completed batches and resumes from the first uncommitted batch without duplicating database mutations.

---

## Batch-Level State Tracking

Each bulk import execution tracks batch progress via the `DataOperationBatch` model:

```prisma
model DataOperationBatch {
  id              String                  @id @default(uuid()) @db.Uuid
  organizationId  String                  @map(\"organization_id\") @db.Uuid
  jobId           String                  @map(\"job_id\") @db.Uuid
  batchIndex      Int                     @map(\"batch_index\")
  totalRows       Int                     @map(\"total_rows\")
  successfulRows  Int                     @default(0) @map(\"successful_rows\")
  failedRows      Int                     @default(0) @map(\"failed_rows\")
  status          DataOperationStatus     @default(PENDING)
  errorMessage    String?                 @map(\"error_message\")
  createdAt       DateTime                @default(now()) @map(\"created_at\")
  updatedAt       DateTime                @updatedAt @map(\"updated_at\")

  @@unique([jobId, batchIndex])
}
```

---

## Resumable Execution Algorithm

When `DataImportService.commit()` executes:

1. It loads existing `DataOperationBatch` records for the target `jobId`.
2. Any batch with `status === DataOperationStatus.COMPLETED` is recorded in `completedBatches: Set<number>`.
3. The job's cumulative counters (`successfulRows`, `failedRows`, `skippedRows`) are seeded from prior runs.
4. During batch iteration:
   ```typescript
   if (completedBatches.has(batchIndex)) {
     // Batch was previously committed — skip without re-executing mutations
     continue;
   }
   ```
5. Uncommitted batches execute within atomic Prisma transactions:
   ```typescript
   await prisma.$transaction(async (tx) => {
     // 1. Execute entity mutations (create/update)
     // 2. Insert batch errors if any
     // 3. Mark DataOperationBatch as COMPLETED
     // 4. Update DataOperationJob processed row counts
   });
   ```

---

## Cancellation Guarantees (INV-545)

When an operator requests job cancellation via `DataOperationJobsService.cancelJob()`:

1. The job status transitions to `CANCELLED`.
2. The active batch in progress finishes its current atomic transaction boundary.
3. No subsequent batches are started.
4. The database is left in a consistent state with no partial records corrupted outside transactional batch boundaries.
