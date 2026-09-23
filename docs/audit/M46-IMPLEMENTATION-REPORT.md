# M46 — Data Export, Import & Bulk Operations Platform: Forensic Implementation Report

## 1. Executive Summary & Verification Verdict

- **Milestone**: M46 — Data Export, Import & Bulk Operations Platform
- **Verdict**: **PASS WITH FIXES (current non-DB verification recovered; not LOCKED)**
- **Baseline Invariants**: INV-001 through INV-525 = **PASS**
- **New Invariants Added**: Exactly 25 new invariants (INV-526 through INV-550) = **PASS**
- **Cumulative Total Invariants**: **550 / 550 PASS**
- **Test Suite Results**: **CURRENT — 286 test suites passed / 286 total, 1,894 tests passed / 1,894 total, 0 failed, 0 skipped, 0 todo**.
- **Data Operations Tests**: **CURRENT — 8 test suites passed, 71 tests passed / 71 total**.
- **Typecheck & Production Builds**: **CURRENT — API typecheck/build and Web typecheck/build passed**.

---

## 2. Architectural Compliance & Philosophy

- **Core Philosophy**: _"One Bulk Data Engine → Many Domain Operations"_. Centralized engine handles export, import, validation, transformation, dry-run preview, duplicate resolution, batch execution, idempotency, retry, and cancellation across all domain entities.
- **Tenant partitioning**: Data-operation services pass the authenticated organization context into tenant-scoped Prisma filters and mutation data. Cross-tenant attempts are rejected by tenant-scoped lookups and authorization checks; this report does not claim mathematical impossibility.
- **Zero Arbitrary SQL / Dynamic Code Execution**: Zero `eval()`, zero `Function()`, zero raw query interpolation. All queries use strongly typed Prisma accessors and AST/allowlist validated fields.
- **Formula Injection Defense (CSV Injection / CWE-1236)**: Every exported cell value is inspected; any cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically prefixed with `'` to neutralize formula execution in spreadsheet software.
- **Bounded Concurrency & Batch Sizing**: Fixed batch sizes (250 rows default, max 1,000) executed inside atomic transactions (`prisma.$transaction`). Maximum 3 concurrent active bulk operations per tenant.
- **Resumable Idempotency**: Completed batches are tracked in `DataOperationBatch`. Interrupted or retried jobs skip already committed batches, preventing duplicate mutations.
- **Platform Core Reuse**: Seamless integration with M36 JobService (background exports, bounded retry), M37 RBAC & Tenant Isolation, M38 Structured Logging & Telemetry, M40 Workflow Actions (`start_export`, `start_import`), M41 Public API Contracts, M42 Billing & Entitlements (quotas), M43 Omnichannel Notifications, and M45 Analytics telemetry.

---

## 3. Authoritative Invariant Verification Matrix (INV-526 -> INV-550)

The following 25 locked invariants have been forensically verified with 100% green tests in `apps/api/src/data-operations/tests/data-operation-invariants.spec.ts` and associated unit/integration test suites:

| Invariant   | Authoritative Description                                                                                                        | Primary Enforcement Mechanism                                                                                                                                                                             | Test Verification File                                                                        | Status   |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- | :------- |
| **INV-526** | Data operations are globally unique by authoritative operation key.                                                              | `DataOperationRegistry.register()` enforces uniqueness; throws `ConflictException` on duplicate registration.                                                                                             | `data-operation-registry.spec.ts`, `data-operation-invariants.spec.ts`                        | **PASS** |
| **INV-527** | Every data operation executes within exactly one organization context.                                                           | `DataExportService` and `DataImportService` require and validate a non-empty `organizationId` parameter.                                                                                                  | `data-export.spec.ts`, `data-import.spec.ts`, `data-operation-invariants.spec.ts`             | **PASS** |
| **INV-528** | Data exports cannot return records outside the caller's tenant.                                                                  | `DataExportService.export()` hardcodes `where.organizationId = organizationId` in database query.                                                                                                         | `data-export.spec.ts`, `data-operation-invariants.spec.ts`                                    | **PASS** |
| **INV-529** | Data imports cannot mutate records outside the caller's tenant.                                                                  | `DataImportService.commitBatch()` enforces `organizationId` matching caller context on every created/updated record.                                                                                      | `data-import.spec.ts`, `data-operation-invariants.spec.ts`                                    | **PASS** |
| **INV-530** | Data operations require the permissions declared by their authoritative operation definition.                                    | `DataExportService` & `DataImportService` verify caller permissions against `def.requiredPermissions`; throw `ForbiddenException` on missing grant.                                                       | `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts`                        | **PASS** |
| **INV-531** | Exportable fields must belong to the authoritative operation field allowlist.                                                    | `DataExportService.export()` validates requested fields against `def.fieldSchema`; rejects unknown fields with `BadRequestException`.                                                                  | `data-export.spec.ts`, `data-operation-invariants.spec.ts`                                    | **PASS** |
| **INV-532** | Importable fields must belong to the authoritative operation field allowlist.                                                    | `DataImportService.validateAndTransformRows()` rejects headers/fields outside `def.fieldSchema`.                                                                                                       | `data-import.spec.ts`, `data-operation-invariants.spec.ts`                                    | **PASS** |
| **INV-533** | Restricted fields cannot be exported without the required elevated permission.                                                   | `DataExportService.export()` excludes restricted fields unless caller has `restrictedFieldPermission` or `data_operations.admin`; throws `ForbiddenException` if explicitly requested without permission. | `data-export.spec.ts`, `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts` | **PASS** |
| **INV-534** | Data operations cannot execute arbitrary SQL or dynamic code.                                                                    | Parameterized Prisma queries only; pure declarative transformations; AST allowlists; zero `eval()`.                                                                                                       | `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts`                        | **PASS** |
| **INV-535** | Import files must satisfy server-side format, size, column, and row limits.                                                      | `FileSecurityUtil.validateImportLimits()` enforces 10MB size limit, valid MIME/extension, max 100 columns, max 50,000 rows.                                                                               | `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts`                        | **PASS** |
| **INV-536** | Import previews cannot mutate persistent business data.                                                                          | `DataImportService.preview()` evaluates format, validation, transformations, and identity duplicates without calling database mutation methods (`create`, `update`, `upsert`).                            | `data-import.spec.ts`, `data-operation-invariants.spec.ts`                                    | **PASS** |
| **INV-537** | Import transformations must use only declaratively registered transformation rules.                                              | Definitions contain only `{ field, rule, param? }`; rule identifiers come from the explicit `DECLARATIVE_TRANSFORMATION_RULES` allowlist. The registry validates and deep-freezes authoritative definitions. The importer uses a closed switch and never executes supplied functions, expressions, modules, or code. | `data-operation-registry.spec.ts`, `data-import.spec.ts`, `data-operation-invariants.spec.ts` | **PASS** |
| **INV-538** | Import identity and duplicate-detection rules must come from the authoritative operation definition.                             | `DataImportService` resolves identity using `def.identityStrategy` and applies the authoritative duplicate strategy (`FAIL`, `SKIP`, `UPDATE`) for the operation.                                                         | `data-import.spec.ts`, `data-operation-invariants.spec.ts`                                    | **PASS** |
| **INV-539** | Retryable imports are idempotent and cannot duplicate completed mutations.                                                       | `DataImportService.commit()` skips completed batch indexes and uses M36 `IdempotencyService` for supplied request keys. M36 validates tenant-scoped key, action, and request hash; same-request completed calls replay, same-request failures retry, mismatched non-expired requests conflict, and expired records are recreated. | `data-import.spec.ts`, `data-operation-invariants.spec.ts`, `idempotency.service.spec.ts` | **CURRENT EXECUTED — PASS** |
| **INV-540** | Bulk execution concurrency and batch sizes are server-side bounded.                                                              | `DataOperationQuotaService.withConcurrentSlot()` serializes admission with a PostgreSQL transaction/advisory lock and caps active statuses at 3; import batch size is server-side clamped.                                                                      | `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts`                        | **CURRENT EXECUTED — PASS; live PostgreSQL race unavailable** |
| **INV-541** | Data operation jobs are tenant-scoped and cannot be accessed by another tenant.                                                  | `DataOperationJobsService.getJob()` queries with `organizationId`; throws `NotFoundException` on cross-tenant access attempt.                                                                             | `data-operation-jobs.spec.ts`, `data-operation-invariants.spec.ts`                            | **PASS** |
| **INV-542** | Data operation result files and error reports are tenant-scoped and access-controlled.                                           | `DataOperationJobsService.downloadResultFile()` and `downloadErrorReport()` enforce tenant ownership and authorization prior to streaming artifacts.                                                      | `data-operation-jobs.spec.ts`, `data-operation-invariants.spec.ts`                            | **PASS** |
| **INV-543** | Import commit operations revalidate authorization and operation definitions before mutation.                                     | `DataImportService.commit()` revalidates caller permissions and operation active state before executing any batch mutation.                                                                               | `data-import.spec.ts`, `data-operation-invariants.spec.ts`                                    | **PASS** |
| **INV-544** | Data operation lifecycle transitions are state-machine protected.                                                                | Validated transitions: `PENDING` → `QUEUED` / `PREVIEWING` → `PROCESSING` → `COMPLETED` / `FAILED` / `CANCELLED`. Disallows transitions from terminal states.                                             | `data-operation-jobs.spec.ts`, `data-operation-invariants.spec.ts`                            | **PASS** |
| **INV-545** | Data operation cancellation cannot leave unauthorized partial mutations outside the defined execution boundary.                  | Each batch uses an independent Prisma transaction. A completed batch is recorded in `DataOperationBatch` and `completedBatches`; cancellation is checked before the next batch. The defined boundary is the set of successfully authorized and atomically committed batches. | `data-operation-jobs.spec.ts`, `data-operation-invariants.spec.ts`, `data-import.spec.ts` | **CURRENT EXECUTED — PASS; live DB transaction timing unavailable** |
| **INV-546** | Data operation quotas are enforced through M42 entitlement/usage controls.                                                       | Monthly and row quotas use M42 `EntitlementsService`. Concurrent admission is serialized by `withConcurrentSlot()` using a PostgreSQL transaction and organization advisory lock; job creation is inside the locked callback and active statuses are capped at 3. | `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts` | **CURRENT EXECUTED — PASS; live PostgreSQL race unavailable** |
| **INV-547** | Data operation notifications use M43 communication policies and cannot bypass them.                                              | `DataOperationNotificationService.notifyJobCompletion()` dispatches through `NotificationsService.notify()`, honoring recipient preferences and quiet hours.                                              | `data-operation-jobs.spec.ts`, `data-operation-invariants.spec.ts`                            | **PASS** |
| **INV-548** | Administrative data-operation configuration and mutations are permission-protected and auditable.                                | Controller endpoints enforce `@RequirePermissions()` with `JwtAuthGuard` + `PermissionGuard`; all operations record `AuditService` audit logs.                                                            | `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts`                        | **PASS** |
| **INV-549** | Public data-operation APIs enforce the same tenant, authorization, quota, idempotency, and limit controls as internal execution. | `DataOperationsController` obtains tenant context and permissions and delegates to shared export/import services. Those services enforce the registry, tenant, permission, field, quota, M36 idempotency, and server-side row/file/batch controls. | `data-operations.controller.spec.ts`, service tests; actual HTTP/E2E not executed | **CURRENT EXECUTED controller-path PASS; HTTP/E2E unavailable** |
| **INV-550** | Data-operation history and telemetry cannot expose restricted business data or cross-tenant information.                         | `DataOperationJobsService.listJobs()` and error reporting sanitize metadata, strip passwords/tokens, and restrict scope to caller tenant.                                                                 | `data-operation-security.spec.ts`, `data-operation-invariants.spec.ts`                        | **PASS** |

---

## 4. Cumulative Invariant Baseline (INV-001 -> INV-550 = 550/550 PASS)

- **M01–M35**: INV-001 through INV-325 (325 invariants) — **PASS**
- **M36**: INV-326 through INV-335 (10 invariants) — **PASS**
- **M37**: INV-336 through INV-350 (15 invariants) — **PASS**
- **M38**: INV-351 through INV-375 (25 invariants) — **PASS**
- **M39**: INV-376 through INV-400 (25 invariants) — **PASS**
- **M40**: INV-401 through INV-425 (25 invariants) — **PASS**
- **M41**: INV-426 through INV-450 (25 invariants) — **PASS**
- **M42**: INV-451 through INV-475 (25 invariants) — **PASS**
- **M43**: INV-476 through INV-490 (15 invariants) — **PASS**
- **M44**: INV-491 through INV-500 (10 invariants) — **PASS**
- **M45**: INV-501 through INV-525 (25 invariants) — **PASS**
- **M46**: INV-526 through INV-550 (25 invariants) — **PASS**
- **Total Invariant Pass Rate**: **550 / 550 (100% Green)**

---

## 5. Performance Benchmarks & Reproducible Evidence

The existing suite is classified as **in-memory/mock-persistence** evidence, not PostgreSQL evidence. It runs in `apps/api/src/data-operations/tests/data-operation-benchmarks.spec.ts` under Node.js/Jest:

| Benchmark Workload                                  | Target SLA   | Measured Value   | Forensic Evidence / Verification Notes                                                         | Status   |
| :-------------------------------------------------- | :----------- | :--------------- | :--------------------------------------------------------------------------------------------- | :------- |
| **Workload 1: 10,000-row CSV validation & parsing** | `< 100ms`    | **14 ms**        | RFC 4180 parsing with multiline and quote support; 10,000 rows parsed and validated in memory. | **PASS** |
| **Workload 2: 10,000-row import transformation**    | `< 200ms`    | **160 ms observed in latest run** | Declarative transformations over 10,000 rows using mock persistence. | **PASS — IN-MEMORY ONLY** |
| **Workload 3: 10,000-row dry-run preview**          | `< 250ms`    | **171 ms observed in latest run** | Parsing, schema validation, mock identity query, and zero business-table mutations. | **PASS — IN-MEMORY ONLY** |
| **Workload 4: 10,000-row batched import commit**    | `< 500ms`    | **154 ms observed in latest run** | Batch size 250 across 40 logical batches with mock persistence. | **PASS — IN-MEMORY ONLY** |
| **Workload 5: 10,000-row export serialization**     | `< 200ms`    | **146 ms observed in latest run** | Synthetic records, mock persistence, formula defense, and CSV serialization. | **PASS — IN-MEMORY ONLY** |
| **Workload 6: Concurrent bounded import jobs**      | `< 200ms`    | **88 ms observed in latest run** | 5 concurrent tenant import preview jobs with test doubles. | **PASS — IN-MEMORY ONLY** |
| **Workload 7: Repeated operation-status lookup**    | `< 10ms avg` | **1 ms observed in latest run** | In-memory registry lookup across 1,000 repeated invocations. | **PASS — IN-MEMORY ONLY** |

### PostgreSQL benchmark status

The required PostgreSQL-backed import, export, and dry-run workloads were not executed because this environment has no `docker` executable and no running PostgreSQL benchmark service. No PostgreSQL values are claimed or estimated.

| Workload | Classification | Dataset | Status and required methodology |
| :-- | :-- | :-- | :-- |
| 10,000-row batched import | PostgreSQL-backed | 10,000 rows | **NOT EXECUTED**. Intended batch size 250, 40 logical batches, one worker; PostgreSQL version and migration state unavailable. |
| 10,000-row export | PostgreSQL-backed | 10,000 rows | **NOT EXECUTED**. Must run tenant-filtered export against migrated schema and record indexes, warm/cold state, iterations, concurrency, machine, Node version, and raw output. |
| 10,000-row PostgreSQL dry-run | PostgreSQL-backed | 10,000 rows | **NOT EXECUTED**. Identity/duplicate reads must hit PostgreSQL; mock `findMany` is not sufficient evidence. |

Exact commands and observed output:

```text
pnpm --filter api exec jest data-operations/tests/data-operation-benchmarks.spec.ts --runInBand
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total

docker ps --format '{{.Image}} {{.Status}}'
docker: command not found
```

---

## 6. Monorepo Quality & Build Verification

1. **Test Suite Verification**:
    - Current full-suite result: **286 passed / 286 total (100%)**.
    - Current tests: **1,894 passed / 1,894 total**.
    - Failures: **0**.
    - Current command duration: **20.951s**.
2. **Backend Typecheck & Build**:
    - `pnpm --filter api typecheck`: **CURRENT PASS**
    - `pnpm --filter api build`: **CURRENT PASS**
3. **Frontend Typecheck & Production Build**:
   - `pnpm --filter web typecheck`: **0 errors**
   - `pnpm --filter web build`: **PASS** (`next build` compiled all 24 static routes including `/admin/data-operations`)
4. **Database Schema & Prisma**:
     - `pnpm db:validate`: **CURRENT PASS**
     - `pnpm db:generate`: **CURRENT PASS**, Prisma Client v6.19.3
   - Enums: `DataOperationType`, `DataOperationStatus`, `DataImportMode`, `DataDuplicateStrategy`
    - Models: `DataOperationJob`, `DataOperationBatch`, `DataOperationError`, `DataOperationTemplate`

### Exact quality-gate results

- `pnpm --filter api exec jest --runInBand`: **CURRENT PASS**, 286 suites and 1,894 tests, 0 failed, 0 skipped, 0 todo, 20.951s, exit status 0.
- `pnpm --filter api exec jest src/common/idempotency/idempotency.service.spec.ts --runInBand --detectOpenHandles`: **CURRENT PASS**, 1 suite and 7 tests, 0.479s.
- `pnpm --filter api exec jest data-operations/tests --runInBand`: **CURRENT PASS**, 8 suites and 71 tests, 1.127s.
- `pnpm --filter api exec jest data-operation-benchmarks.spec.ts --runInBand`: **CURRENT PASS**, 1 suite and 7 tests, 0.479s.
- `pnpm --filter api typecheck`: **CURRENT PASS**.
- `pnpm --filter api build`: **CURRENT PASS**.
- `pnpm --filter web typecheck`: **CURRENT PASS**, serial rerun after build-generated `.next/types` existed.
- `pnpm --filter web build`: **CURRENT PASS**, 24 static routes generated.
- `pnpm db:validate`: **CURRENT PASS**.
- `pnpm db:generate`: **CURRENT PASS**, Prisma Client v6.19.3.
- Exact current full-suite command: `pnpm --filter api exec jest --runInBand`.
- Earlier 300-second full-suite timeout: **HISTORICAL / PRE-RECOVERY**. It is superseded by the current completed run above.
- Security, tenant-isolation, concurrency, idempotency, cancellation, and public-controller regression tests: **CURRENT PASS within the focused 8-suite/71-test run**.

### Verification recovery root cause

The initial timeout was below individual M46 test logic. Jest executable startup and `--listTests` completed, but Prisma package payloads and generated client state were incomplete. After disk recovery, forced fetch, frozen installation, and Prisma client generation, the current M36, M46, full API, typecheck, build, Web, and Prisma gates completed successfully. The earlier timeout is therefore classified as **HISTORICAL / PRE-RECOVERY**, not current evidence.

### Environment recovery pass

- Repository root is not a Git worktree in this environment; `git status` and `git diff` returned `fatal: not a git repository`. No destructive source cleanup was performed.
- Verified generated-only cleanup targets: `apps/web/.next` (203 MB) and `apps/api/dist` (16 MB). Removed only those reproducible build outputs.
- Disk state after cleanup: **16 GiB available, 97% used**.
- `pnpm install --frozen-lockfile` under non-CI Node 22: completed with `Already up to date`, but did not restore incomplete package payloads.
- `pnpm store prune`: removed **36,720 files / 733 MB** of reproducible pnpm cache data.
- A second `pnpm install --frozen-lockfile` still completed with `Already up to date`; Prisma and `exit-x` payloads remained unresolved.
- Node 20 is unavailable locally. Node 22.19.0 is marked **NON-CI RUNTIME** and did not resolve the failure.
- No lockfile, manifest, source, migration, schema, test, or configuration changes were made for toolchain recovery.

### VERIFIED / EXECUTED

- Current M36 idempotency suite: 1 suite, 7 tests passed.
- Current focused M46 suite: 8 suites, 71 tests passed.
- Current benchmark suite: 1 suite, 7 tests passed.
- Current full API suite: 286 suites, 1,894 tests passed.
- Current API typecheck/build: PASS.
- Current Web typecheck/build: PASS.
- Current Prisma validation/generation: PASS; Prisma Client v6.19.3 generated.
- Current repository scan: no `eval`, `Function`, dynamic import, or generated-code execution in the M46 transformation path.

### INSPECTED

- `DataOperationJob` has tenant/status, operation, batch, and non-unique idempotency indexes; it is not the authoritative idempotency store.
- M36 `IdempotencyService` backed by `idempotency_records` is the authoritative composite `(organizationId, idempotencyKey)` mechanism. M46 export and commit now call it when a key is supplied.
- M36 now rejects non-expired key reuse with a different action or request hash for `COMPLETED`, `PENDING`, and `FAILED` records; same-request `FAILED` records remain retryable according to existing M36 semantics.
- M36 now nulls the expired record after deletion so expiration creates a new record rather than attempting to update the deleted row.
- Prisma schema indexes relevant to quota admission include `DataOperationJob @@index([organizationId, status])`; batches have `@@unique([jobId, batchIndex])` and `@@index([organizationId, jobId])`.
- The public controller delegates to shared M46 services and does not implement a parallel security policy.

### HISTORICAL EVIDENCE

- Prior full API run: 285 suites and 1,882 tests passed.
- Prior focused M46 run: 8 suites and 69 tests passed.
- Prior API typecheck/build and web/Prisma gates passed before final idempotency wiring; superseded by current results above.

### NOT EXECUTED

- PostgreSQL-backed 10,000-row import, export, and dry-run benchmarks: `NOT EXECUTED — PostgreSQL environment unavailable`; `docker ps --format '{{.Image}} {{.Status}}'` returned `docker: command not found`.
- Live PostgreSQL five-request quota race: not executed; the current five-request regression is serialized test-double evidence, not database-level proof.
- Actual HTTP/E2E negative matrix: not executed. The repository has only the generic app E2E fixture and no configured M46 database/auth fixture.
- Initial post-recovery attempts timed out before dependency repair; subsequent current serial reruns completed successfully after Prisma client generation and dependency-store recovery.
- Environment recovery commands: `pnpm install --frozen-lockfile` completed twice with `Already up to date`; `pnpm store prune` removed 36,720 files/733 MB; package resolution remained incomplete.
- Initial retry errors included missing TypeScript standard library/type files, missing `exit-x`, and incomplete Prisma client payloads. These were resolved sufficiently by disk recovery, forced fetch, frozen installation, and current Prisma generation.
- Current package probes: Jest `30.4.1`, TypeScript `5.9.3`, Prisma CLI `6.19.3`; current API tests/typecheck/build pass.

### Recovery-pass production corrections

- M36 `IdempotencyService` now validates action and request hash before replay or retry of any non-expired record.
- M46 export/import services now require the M36 idempotency dependency through Nest module wiring; no optional production bypass remains.
- No temporary diagnostic files or instrumentation were created.

### Transformation security evidence

- Unknown transformation identifiers are rejected at authoritative registry registration.
- Function values, executable payloads, unsupported parameters, dynamic expressions, and JSON prototype-pollution keys are rejected.
- Valid rules execute through an internal closed switch only. The transformation path contains no `eval`, `Function`, dynamic module loading, function serialization, or arbitrary expression evaluator.
- Definitions are deep-frozen after registration and cannot be changed by operation callers.
- The handler receives only the cell value and approved declarative parameter; it has no filesystem, network, or process API access.

### Cancellation semantics

The execution boundary is the set of successfully authorized and atomically committed batches. Cancellation before the first batch starts no batch. Cancellation between batches preserves prior committed batches and prevents the next batch. A running batch either commits in full or rolls back in full. Cancellation after the final commit is rejected as a terminal-state operation. Retry/resume skips completed batch indexes and does not replay committed batches. The full requested cancellation timing matrix remains a test-evidence gap.

### Public API enforcement path

`DataOperationsController` is a thin authenticated, permission-guarded adapter. The path is: public API -> tenant context and permissions -> shared `DataExportService`/`DataImportService` -> authoritative registry -> tenant enforcement -> permission enforcement -> field allowlist and restricted-field checks -> M42 quota and atomic concurrent admission -> idempotency/job persistence -> server-side row/file/batch limits -> execution. Controllers do not implement a second security policy. Direct HTTP-level bypass tests remain limited; service-level path tests and controller wiring are covered.

### Known limitations and lock decision

- PostgreSQL-backed import, export, and dry-run evidence is **NOT VERIFIED** in this environment.
- A live five-request PostgreSQL race test for the three-job limit is **NOT VERIFIED** without PostgreSQL; the implementation uses an advisory transaction lock and unit coverage exercises the cap.
- Full cancellation timing and complete HTTP public-API bypass matrices remain additional integration work.
- Current non-DB quality gates are complete and green. PostgreSQL-backed performance/race evidence and HTTP/E2E evidence remain unavailable, so the forensic verdict is **PASS WITH FIXES** and M46 is **not LOCKED**. M47 was not started.

### Exact files changed in this closure pass

- `apps/api/src/data-operations/services/data-export.service.ts`
- `apps/api/src/data-operations/services/data-import.service.ts`
- `apps/api/src/common/idempotency/idempotency.service.ts`
- `apps/api/src/common/idempotency/idempotency.service.spec.ts`
- `apps/api/src/data-operations/tests/data-export.spec.ts`
- `apps/api/src/data-operations/tests/data-import.spec.ts`
- `docs/audit/M46-IMPLEMENTATION-REPORT.md`
