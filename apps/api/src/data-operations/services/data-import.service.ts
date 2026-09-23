import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DataOperationRegistryService,
  DataOperationDefinition,
  DeclarativeTransformationRule,
} from '../registry/data-operation.registry';
import { FileSecurityUtil } from '../utils/file-security.util';
import { CsvParserUtil } from '../utils/csv-parser.util';
import { DataOperationQuotaService } from './data-operation-quota.service';
import { DataOperationNotificationService } from './data-operation-notification.service';
import { AuditService } from '../../audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import {
  DataOperationJob,
  DataOperationStatus,
  DataOperationType,
  DataImportMode,
  DataDuplicateStrategy,
  ExportFormat,
} from '@prisma/client';

export interface ImportPreviewParams {
  organizationId: string;
  operationKey: string;
  fileContent: string;
  format?: 'CSV' | 'JSON';
  mode?: DataImportMode;
  duplicateStrategy?: DataDuplicateStrategy;
  actorUserId?: string;
  userPermissions?: string[];
  dryRun?: boolean;
}

export interface ImportCommitParams extends ImportPreviewParams {
  jobId?: string;
  idempotencyKey?: string;
  batchSize?: number;
}

export interface RowValidationError {
  rowNumber: number;
  fieldName?: string;
  errorCode: string;
  errorMessage: string;
  rawValues?: Record<string, unknown>;
}

export interface ValidatedRowResult {
  rowNumber: number;
  raw: Record<string, unknown>;
  transformed: Record<string, unknown>;
  isDuplicate: boolean;
  existingId?: string;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  errors: RowValidationError[];
}

export interface ImportPreviewResult {
  jobId: string;
  operationKey: string;
  mode: DataImportMode;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  plannedCreates: number;
  plannedUpdates: number;
  plannedSkips: number;
  errors: RowValidationError[];
  warnings: string[];
  previewRows: Record<string, unknown>[];
}

export interface ImportCommitResult {
  jobId: string;
  operationKey: string;
  status: DataOperationStatus;
  mode: DataImportMode;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  skippedRows: number;
  durationMs: number;
  errorsCount: number;
}

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: DataOperationRegistryService,
    private readonly quotaService: DataOperationQuotaService,
    private readonly notificationService: DataOperationNotificationService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Preview / Dry-run import.
   * Enforces INV-535, INV-536 (zero persistent DB mutations), INV-537, INV-538.
   */
  async preview(params: ImportPreviewParams): Promise<ImportPreviewResult> {
    const { organizationId, operationKey, actorUserId } = params;

    // 1. Definition check
    const def = this.registry.get(operationKey);
    if (def.operationType !== DataOperationType.IMPORT) {
      throw new BadRequestException(
        `Operation "${operationKey}" is not an IMPORT operation.`,
      );
    }

    // 2. Permission check (INV-530)
    const userPerms = params.userPermissions ?? [];
    this.assertOperationPermissions(def, userPerms, false);

    // 3. Quota check (INV-546)
    await this.quotaService.assertQuota(
      organizationId,
      DataOperationType.IMPORT,
      1,
    );

    // 4. File limits, format, and parsing (INV-535)
    const rawRows = this.parseInput(params.fileContent, params.format ?? 'CSV');

    FileSecurityUtil.enforceLimits({
      fileSizeBytes: Buffer.byteLength(params.fileContent, 'utf-8'),
      maxFileSize: def.maxFileSize,
      totalRows: rawRows.length,
      maxRows: def.maxRows,
      columnCount: rawRows.length > 0 ? Object.keys(rawRows[0]).length : 0,
      maxColumns: def.maxColumns,
    });

    const mode = params.mode ?? DataImportMode.UPSERT;
    const dupStrategy =
      params.duplicateStrategy ??
      def.duplicateStrategy ??
      DataDuplicateStrategy.UPDATE;

    // 5. Schema validation & row processing (INV-532, INV-537, INV-538)
    const validatedRows = await this.validateAndTransformRows(
      organizationId,
      def,
      rawRows,
      mode,
      dupStrategy,
    );

    const allErrors = validatedRows.flatMap((r) => r.errors);
    const validCount = validatedRows.filter((r) => r.action !== 'ERROR').length;
    const plannedCreates = validatedRows.filter(
      (r) => r.action === 'CREATE',
    ).length;
    const plannedUpdates = validatedRows.filter(
      (r) => r.action === 'UPDATE',
    ).length;
    const plannedSkips = validatedRows.filter(
      (r) => r.action === 'SKIP',
    ).length;

    // 6. Create Job record in PREVIEWING state (INV-536: Persistent business data NOT mutated)
    const job = await this.quotaService.withConcurrentSlot(organizationId, () =>
      this.prisma.dataOperationJob.create({
        data: {
        organizationId,
        operationKey,
        operationType: DataOperationType.IMPORT,
        status: DataOperationStatus.PREVIEWING,
        format: params.format === 'JSON' ? ExportFormat.JSON : ExportFormat.CSV,
        mode,
        dryRun: true,
        totalRows: rawRows.length,
        processedRows: rawRows.length,
        successfulRows: validCount,
        failedRows: allErrors.length,
        skippedRows: plannedSkips,
        createdById: actorUserId,
        parameters: {
          mode,
          duplicateStrategy: dupStrategy,
          dryRun: true,
        },
        resultSummary: {
          plannedCreates,
          plannedUpdates,
          plannedSkips,
          invalidRows: allErrors.length,
        },
        },
      }),
    );

    const previewResult = {
      jobId: job.id,
      operationKey,
      mode,
      totalRows: rawRows.length,
      validRows: validCount,
      invalidRows: allErrors.length,
      plannedCreates,
      plannedUpdates,
      plannedSkips,
      errors: allErrors.slice(0, 100), // bounded return errors
      warnings: [],
      previewRows: validatedRows.slice(0, 10).map((r) => r.transformed),
    };
    return previewResult;
  }

  /**
   * Commit / Batch Execute import.
   * Enforces INV-529, INV-530, INV-539 (resumable idempotency),
   * INV-540 (bounded batch/concurrency), INV-543 (pre-commit revalidation),
   * INV-544 (state machine), INV-545 (cancellation boundary).
   */
  async commit(params: ImportCommitParams): Promise<ImportCommitResult> {
    const startTime = Date.now();
    const { organizationId, operationKey, actorUserId } = params;

    // 1. Definition check & pre-commit revalidation (INV-543)
    const def = this.registry.get(operationKey);
    if (def.operationType !== DataOperationType.IMPORT) {
      throw new BadRequestException(
        `Operation "${operationKey}" is not an IMPORT operation.`,
      );
    }

    // 2. Pre-commit authorization revalidation (INV-543)
    const userPerms = params.userPermissions ?? [];
    this.assertOperationPermissions(def, userPerms, true);

    // 3. Parse input
    const rawRows = this.parseInput(params.fileContent, params.format ?? 'CSV');

    FileSecurityUtil.enforceLimits({
      fileSizeBytes: Buffer.byteLength(params.fileContent, 'utf-8'),
      maxFileSize: def.maxFileSize,
      totalRows: rawRows.length,
      maxRows: def.maxRows,
      columnCount: rawRows.length > 0 ? Object.keys(rawRows[0]).length : 0,
      maxColumns: def.maxColumns,
    });

    const mode = params.mode ?? DataImportMode.UPSERT;
    const dupStrategy =
      params.duplicateStrategy ??
      def.duplicateStrategy ??
      DataDuplicateStrategy.UPDATE;

    // 4. Validate & Transform
    const validatedRows = await this.validateAndTransformRows(
      organizationId,
      def,
      rawRows,
      mode,
      dupStrategy,
    );

    let idempotencyStarted = false;
    if (params.idempotencyKey) {
      const idempotencyResult = await this.idempotency.start(
        organizationId,
        params.idempotencyKey,
        `data_operations.import:${operationKey}`,
        params,
      );
      if (idempotencyResult.isReplay) {
        return idempotencyResult.responseBody as ImportCommitResult;
      }
      idempotencyStarted = true;
    }

    // 5. Retrieve or create job
    let job: DataOperationJob;
    let initialCompletedBatches: number[] = [];
    let initialSuccessfulRows = 0;
    let initialFailedRows = 0;
    let initialSkippedRows = 0;

    if (params.jobId) {
      const existingJob = await this.prisma.dataOperationJob.findFirstOrThrow({
        where: { id: params.jobId, organizationId },
      });
      initialCompletedBatches = existingJob.completedBatches || [];
      initialSuccessfulRows = existingJob.successfulRows || 0;
      initialFailedRows = existingJob.failedRows || 0;
      initialSkippedRows = existingJob.skippedRows || 0;

      // State machine validation (INV-544)
      if (
        existingJob.status !== DataOperationStatus.PREVIEWING &&
        existingJob.status !== DataOperationStatus.PENDING &&
        existingJob.status !== DataOperationStatus.PROCESSING &&
        existingJob.status !== DataOperationStatus.FAILED &&
        existingJob.status !== DataOperationStatus.PARTIALLY_COMPLETED
      ) {
        throw new BadRequestException(
          `Cannot commit job in "${existingJob.status}" status.`,
        );
      }
      job = await this.prisma.dataOperationJob.update({
        where: { id: existingJob.id },
        data: {
          status: DataOperationStatus.PROCESSING,
          mode,
          dryRun: false,
          startedAt: new Date(),
        },
      });
    } else {
      job = await this.quotaService.withConcurrentSlot(organizationId, () =>
        this.prisma.dataOperationJob.create({
          data: {
          organizationId,
          operationKey,
          operationType: DataOperationType.IMPORT,
          status: DataOperationStatus.PROCESSING,
          format:
            params.format === 'JSON' ? ExportFormat.JSON : ExportFormat.CSV,
          mode,
          dryRun: false,
          totalRows: rawRows.length,
          idempotencyKey: params.idempotencyKey,
          createdById: actorUserId,
          startedAt: new Date(),
          },
        }),
      );
    }

    // 6. Bounded batch chunking (INV-540)
    const batchSize = Math.min(Math.max(params.batchSize ?? 100, 10), 500);
    const batches: ValidatedRowResult[][] = [];
    for (let i = 0; i < validatedRows.length; i += batchSize) {
      batches.push(validatedRows.slice(i, i + batchSize));
    }

    const completedBatchIndices = new Set<number>(initialCompletedBatches);
    let successfulCount = initialSuccessfulRows;
    let failedCount = initialFailedRows;
    let skippedCount = initialSkippedRows;

    const delegate = (this.prisma as any)[def.modelName];
    if (!delegate) {
      throw new BadRequestException(
        `Model delegate "${def.modelName}" not found.`,
      );
    }

    // 7. Execute batches with idempotency & cancellation check (INV-539, INV-545)
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      // Cancellation check before each batch (INV-545)
      const currentJobState = await this.prisma.dataOperationJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      if (currentJobState?.status === DataOperationStatus.CANCELLED) {
        this.logger.warn(
          `Job ${job.id} was cancelled. Halting batch processing.`,
        );
        break;
      }

      // Idempotency: Skip already completed batches (INV-539)
      if (completedBatchIndices.has(batchIdx)) {
        continue;
      }

      const batch = batches[batchIdx];
      const startRow = batchIdx * batchSize + 1;
      const endRow = startRow + batch.length - 1;

      // Upsert batch record
      await this.prisma.dataOperationBatch.upsert({
        where: {
          jobId_batchIndex: {
            jobId: job.id,
            batchIndex: batchIdx,
          },
        },
        create: {
          jobId: job.id,
          organizationId,
          batchIndex: batchIdx,
          status: 'PROCESSING',
          startRow,
          endRow,
          rowCount: batch.length,
        },
        update: {
          status: 'PROCESSING',
        },
      });

      let batchSuccesses = 0;
      let batchFailures = 0;

      // Execute batch operations transactionally per batch boundary (INV-545)
      try {
        await this.prisma.$transaction(async (tx: any) => {
          const txDelegate = tx[def.modelName];

          for (const item of batch) {
            if (item.action === 'SKIP') {
              skippedCount++;
              continue;
            }

            if (item.action === 'ERROR') {
              batchFailures++;
              failedCount++;
              for (const err of item.errors) {
                await tx.dataOperationError.create({
                  data: {
                    jobId: job.id,
                    organizationId,
                    rowNumber: err.rowNumber,
                    fieldName: err.fieldName,
                    errorCode: err.errorCode,
                    errorMessage: err.errorMessage,
                    rawValues: err.rawValues,
                  },
                });
              }
              continue;
            }

            // INV-529: Mutate strictly within caller's organization
            const entityData: Record<string, unknown> = {
              ...item.transformed,
              organizationId,
            };

            if (item.action === 'CREATE') {
              await txDelegate.create({ data: entityData });
              batchSuccesses++;
              successfulCount++;
            } else if (item.action === 'UPDATE' && item.existingId) {
              await txDelegate.update({
                where: { id: item.existingId, organizationId },
                data: entityData,
              });
              batchSuccesses++;
              successfulCount++;
            }
          }
        });

        // Mark batch completed
        await this.prisma.dataOperationBatch.update({
          where: {
            jobId_batchIndex: {
              jobId: job.id,
              batchIndex: batchIdx,
            },
          },
          data: {
            status: 'COMPLETED',
            successfulCount: batchSuccesses,
            failedCount: batchFailures,
            completedAt: new Date(),
          },
        });

        completedBatchIndices.add(batchIdx);

        // Update job progress with completed batches array (INV-539)
        await this.prisma.dataOperationJob.update({
          where: { id: job.id },
          data: {
            processedRows: successfulCount + failedCount + skippedCount,
            successfulRows: successfulCount,
            failedRows: failedCount,
            skippedRows: skippedCount,
            completedBatches: Array.from(completedBatchIndices),
          },
        });
      } catch (batchErr: unknown) {
        const msg =
          batchErr instanceof Error ? batchErr.message : String(batchErr);
        await this.prisma.dataOperationBatch.update({
          where: {
            jobId_batchIndex: {
              jobId: job.id,
              batchIndex: batchIdx,
            },
          },
          data: {
            status: 'FAILED',
            error: msg,
            completedAt: new Date(),
          },
        });
        failedCount += batch.length;
      }
    }

    const durationMs = Date.now() - startTime;
    const finalJobState = await this.prisma.dataOperationJob.findUniqueOrThrow({
      where: { id: job.id },
    });

    let finalStatus: DataOperationStatus = DataOperationStatus.COMPLETED;
    if (finalJobState.status === DataOperationStatus.CANCELLED) {
      finalStatus = DataOperationStatus.CANCELLED;
    } else if (failedCount > 0 && successfulCount === 0) {
      finalStatus = DataOperationStatus.FAILED;
    } else if (failedCount > 0 && successfulCount > 0) {
      finalStatus = DataOperationStatus.PARTIALLY_COMPLETED;
    }

    const updatedJob = await this.prisma.dataOperationJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        processedRows: successfulCount + failedCount + skippedCount,
        successfulRows: successfulCount,
        failedRows: failedCount,
        skippedRows: skippedCount,
        completedAt: new Date(),
        resultSummary: {
          durationMs,
          successfulRows: successfulCount,
          failedRows: failedCount,
          skippedRows: skippedCount,
        },
      },
    });

    // Audit log (INV-548)
    await this.audit.record({
      action: 'data_operations.import.completed',
      resource: 'data_operations',
      eventName: 'data_operations.import.completed',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      details: {
        jobId: job.id,
        operationKey,
        status: finalStatus,
        successfulRows: successfulCount,
        failedRows: failedCount,
        durationMs,
      },
    });

    // Notifications (INV-547)
    if (finalStatus === DataOperationStatus.FAILED) {
      await this.notificationService.notifyJobFailure(
        updatedJob,
        'Import completed with failures',
      );
    } else {
      await this.notificationService.notifyJobCompletion(updatedJob);
    }

    const importResult = {
      jobId: job.id,
      operationKey,
      status: finalStatus,
      mode,
      totalRows: rawRows.length,
      processedRows: successfulCount + failedCount + skippedCount,
      successfulRows: successfulCount,
      failedRows: failedCount,
      skippedRows: skippedCount,
      durationMs,
      errorsCount: failedCount,
    };
    if (idempotencyStarted && params.idempotencyKey) {
      await this.idempotency!.complete(
        organizationId,
        params.idempotencyKey,
        200,
        importResult,
        'data_operation_job',
        job.id,
      );
    }
    return importResult;
  }

  /**
   * Validates and transforms parsed rows against authoritative definition.
   * Enforces INV-532 (allowlist), INV-537 (transformations), INV-538 (duplicate detection).
   */
  async validateAndTransformRows(
    organizationId: string,
    def: DataOperationDefinition,
    rawRows: Record<string, unknown>[],
    mode: DataImportMode,
    dupStrategy: DataDuplicateStrategy,
  ): Promise<ValidatedRowResult[]> {
    const allowlist = new Set(def.fieldSchema.map((f) => f.name));
    const schemaMap = new Map(def.fieldSchema.map((f) => [f.name, f]));
    const results: ValidatedRowResult[] = [];

    // Pre-fetch existing records for duplicate detection (INV-538)
    const existingRecords = await this.loadExistingRecords(organizationId, def);

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 1;
      const rowErrors: RowValidationError[] = [];
      const transformed: Record<string, unknown> = {};

      // 1. Check for unknown fields (INV-532)
      for (const field of Object.keys(row)) {
        if (!allowlist.has(field)) {
          rowErrors.push({
            rowNumber,
            fieldName: field,
            errorCode: 'UNKNOWN_FIELD',
            errorMessage: `Field "${field}" is not in the authoritative import allowlist.`,
            rawValues: row,
          });
        }
      }

      // 2. Validate & apply default values for schema fields
      for (const fieldDef of def.fieldSchema) {
        let val = row[fieldDef.name];

        if (
          (val === undefined || val === null || val === '') &&
          fieldDef.defaultValue !== undefined
        ) {
          val = fieldDef.defaultValue;
        }

        if (
          fieldDef.required &&
          (val === undefined || val === null || val === '')
        ) {
          rowErrors.push({
            rowNumber,
            fieldName: fieldDef.name,
            errorCode: 'REQUIRED_FIELD_MISSING',
            errorMessage: `Required field "${fieldDef.name}" is missing or empty.`,
            rawValues: row,
          });
          continue;
        }

        if (val !== undefined && val !== null && val !== '') {
          // Validate field type
          if (!this.validateType(val, fieldDef.type, fieldDef.allowedValues)) {
            rowErrors.push({
              rowNumber,
              fieldName: fieldDef.name,
              errorCode: 'INVALID_FIELD_TYPE',
              errorMessage: `Field "${fieldDef.name}" has invalid value for type "${fieldDef.type}".`,
              rawValues: row,
            });
          }
        }

        transformed[fieldDef.name] = val;
      }

      // 3. Apply custom validation rules
      for (const rule of def.validationRules) {
        const val = transformed[rule.field];
        if (val !== undefined && val !== null && val !== '') {
          if (!this.evaluateValidationRule(val, rule)) {
            rowErrors.push({
              rowNumber,
              fieldName: rule.field,
              errorCode: 'VALIDATION_RULE_FAILED',
              errorMessage: rule.message,
              rawValues: row,
            });
          }
        }
      }

      // 4. Apply declarative transformation rules (INV-537)
      for (const tRule of def.transformationRules) {
        const val = transformed[tRule.field];
        if (val !== undefined && val !== null && val !== '') {
          transformed[tRule.field] = this.applyTransformation(
            val,
            tRule.rule,
            tRule.param,
          );
        }
      }

      // 5. Identity & duplicate detection (INV-538)
      const identityKey = this.computeIdentityKey(
        transformed,
        def.identityStrategy,
      );
      const existingRecord = identityKey
        ? existingRecords.get(identityKey)
        : undefined;
      const isDuplicate = !!existingRecord;

      let action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR' = 'CREATE';

      if (rowErrors.length > 0) {
        action = 'ERROR';
      } else if (isDuplicate) {
        if (mode === DataImportMode.CREATE_ONLY) {
          action = 'ERROR';
          rowErrors.push({
            rowNumber,
            errorCode: 'DUPLICATE_RECORD_REJECTED',
            errorMessage: `Record with identity (${identityKey}) already exists in CREATE_ONLY mode.`,
            rawValues: row,
          });
        } else if (dupStrategy === DataDuplicateStrategy.SKIP) {
          action = 'SKIP';
        } else {
          action = 'UPDATE';
        }
      } else {
        if (mode === DataImportMode.UPDATE_ONLY) {
          action = 'ERROR';
          rowErrors.push({
            rowNumber,
            errorCode: 'RECORD_NOT_FOUND',
            errorMessage: `Record with identity (${identityKey}) not found in UPDATE_ONLY mode.`,
            rawValues: row,
          });
        } else {
          action = 'CREATE';
        }
      }

      results.push({
        rowNumber,
        raw: row,
        transformed,
        isDuplicate,
        existingId: existingRecord?.id,
        action,
        errors: rowErrors,
      });
    }

    return results;
  }

  private parseInput(
    content: string,
    format: 'CSV' | 'JSON',
  ): Record<string, unknown>[] {
    if (format === 'JSON') {
      try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          throw new BadRequestException(
            'JSON import payload must be an array of objects.',
          );
        }
        return parsed;
      } catch (e: unknown) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException('Malformed JSON file content.');
      }
    } else {
      const parsed = CsvParserUtil.parse(content);
      return parsed.rows;
    }
  }

  private assertOperationPermissions(
    def: DataOperationDefinition,
    userPerms: string[],
    isCommit: boolean,
  ): void {
    const permSet = new Set(userPerms);
    if (permSet.has('data_operations.admin')) {
      return;
    }

    const required = isCommit
      ? def.requiredPermissions
      : [
          'data_operations.import.preview',
          ...def.requiredPermissions.filter((p) => !p.endsWith('.execute')),
        ];

    for (const req of required) {
      if (!permSet.has(req)) {
        throw new ForbiddenException(
          `Missing required permission "${req}" for operation "${def.operationKey}".`,
        );
      }
    }
  }

  private validateType(
    val: unknown,
    type: string,
    allowedValues?: string[],
  ): boolean {
    if (val === null || val === undefined || val === '') return true;
    switch (type) {
      case 'string':
        return typeof val === 'string' || typeof val === 'number';
      case 'number':
      case 'currency_cents':
        return !isNaN(Number(val));
      case 'boolean':
        return (
          typeof val === 'boolean' ||
          ['true', 'false', '1', '0', 'yes', 'no'].includes(
            String(val).toLowerCase(),
          )
        );
      case 'date':
        return !isNaN(Date.parse(String(val)));
      case 'enum':
        if (allowedValues && allowedValues.length > 0) {
          return allowedValues.includes(String(val));
        }
        return true;
      default:
        return true;
    }
  }

  private evaluateValidationRule(val: unknown, rule: any): boolean {
    const str = String(val);
    switch (rule.rule) {
      case 'regex':
        return new RegExp(rule.param).test(str);
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
      case 'min':
        return Number(val) >= Number(rule.param);
      case 'max':
        return Number(val) <= Number(rule.param);
      default:
        return true;
    }
  }

  private applyTransformation(
    val: unknown,
    rule: DeclarativeTransformationRule,
    param?: unknown,
  ): unknown {
    const str = String(val);
    switch (rule) {
      case 'TRIM':
        return str.trim();
      case 'LOWERCASE':
        return str.toLowerCase();
      case 'UPPERCASE':
        return str.toUpperCase();
      case 'TO_CENTS': {
        const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? 0 : Math.round(num * 100);
      }
      case 'NORMALIZE_PHONE':
        return str.replace(/[^0-9+]/g, '');
      case 'DEFAULT_VALUE':
        return str === '' ? param : val;
      case 'PARSE_DATE': {
        const date = new Date(str);
        if (Number.isNaN(date.getTime())) {
          throw new BadRequestException('PARSE_DATE received an invalid date.');
        }
        return date.toISOString();
      }
    }
  }

  private computeIdentityKey(
    data: Record<string, unknown>,
    identityFields: string[],
  ): string {
    return identityFields
      .map((f) =>
        String(data[f] || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean)
      .join('::');
  }

  private async loadExistingRecords(
    organizationId: string,
    def: DataOperationDefinition,
  ): Promise<Map<string, { id: string }>> {
    const map = new Map<string, { id: string }>();
    const delegate = (this.prisma as any)[def.modelName];
    if (!delegate || typeof delegate.findMany !== 'function') {
      return map;
    }

    const select: Record<string, boolean> = { id: true };
    for (const idField of def.identityStrategy) {
      select[idField] = true;
    }

    try {
      const records = await delegate.findMany({
        where: { organizationId },
        select,
      });

      for (const rec of records) {
        const key = this.computeIdentityKey(rec, def.identityStrategy);
        if (key) {
          map.set(key, { id: rec.id });
        }
      }
    } catch {
      // Model might not have identity field or table empty
    }

    return map;
  }
}
