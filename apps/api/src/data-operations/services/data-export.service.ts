import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DataOperationRegistryService } from '../registry/data-operation.registry';
import { FileSecurityUtil } from '../utils/file-security.util';
import { DataOperationQuotaService } from './data-operation-quota.service';
import { DataOperationNotificationService } from './data-operation-notification.service';
import { AuditService } from '../../audit/audit.service';
import { JobService } from '../../common/jobs/job.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import {
  DataOperationJob,
  DataOperationStatus,
  DataOperationType,
  ExportFormat,
} from '@prisma/client';

export interface ExportExecutionParams {
  organizationId: string;
  operationKey: string;
  fields?: string[];
  filters?: Record<string, unknown>;
  format?: 'CSV' | 'JSON';
  limit?: number;
  actorUserId?: string;
  userPermissions?: string[];
  idempotencyKey?: string;
  async?: boolean;
}

export interface ExportResult {
  jobId: string;
  operationKey: string;
  format: 'CSV' | 'JSON';
  rowCount: number;
  fileContent: string;
  fileName: string;
  fileSizeBytes: number;
  durationMs: number;
}

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: DataOperationRegistryService,
    private readonly quotaService: DataOperationQuotaService,
    private readonly notificationService: DataOperationNotificationService,
    private readonly audit: AuditService,
    private readonly jobService: JobService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Main export execution entrypoint.
   * Enforces INV-527, INV-528, INV-530, INV-531, INV-533, INV-534, INV-535.
   */
  async export(
    params: ExportExecutionParams,
  ): Promise<ExportResult | { jobId: string; status: DataOperationStatus }> {
    const startTime = Date.now();
    const { organizationId, operationKey, actorUserId } = params;

    // 1. Definition check
    const def = this.registry.get(operationKey);
    if (def.operationType !== DataOperationType.EXPORT) {
      throw new BadRequestException(
        `Operation "${operationKey}" is not an EXPORT operation.`,
      );
    }

    // 2. Permission check (INV-530)
    const userPerms = params.userPermissions ?? [];
    const permSet = new Set(userPerms);
    if (!permSet.has('data_operations.admin')) {
      for (const reqPerm of def.requiredPermissions) {
        if (!permSet.has(reqPerm)) {
          throw new ForbiddenException(
            `Missing required permission "${reqPerm}" for operation "${operationKey}".`,
          );
        }
      }
    }

    // 3. Field selection & restricted fields check (INV-531, INV-533)
    const hasElevatedPerm =
      permSet.has('data_operations.admin') ||
      permSet.has('data_operations.restricted_fields.export');

    const selectedFields =
      params.fields && params.fields.length > 0
        ? params.fields
        : def.fieldSchema
            .filter(
              (f) =>
                !f.isRestricted ||
                hasElevatedPerm ||
                permSet.has(def.restrictedFieldPermissions[f.name] || ''),
            )
            .map((f) => f.name);

    this.registry.validateFieldSelection(operationKey, selectedFields);
    this.registry.assertFieldPermissions(
      operationKey,
      selectedFields,
      userPerms,
    );

    // 4. Quota check (INV-546)
    const effectiveLimit = Math.min(params.limit ?? def.maxRows, def.maxRows);
    await this.quotaService.assertQuota(
      organizationId,
      DataOperationType.EXPORT,
      effectiveLimit,
    );

    let idempotencyStarted = false;
    if (params.idempotencyKey) {
      const idempotencyResult = await this.idempotency.start(
        organizationId,
        params.idempotencyKey,
        `data_operations.export:${operationKey}`,
        params,
      );
      if (idempotencyResult.isReplay) {
        return idempotencyResult.responseBody as ExportResult;
      }
      idempotencyStarted = true;
    }

    const format = params.format ?? 'CSV';
    const exportFormatEnum =
      format === 'JSON' ? ExportFormat.JSON : ExportFormat.CSV;

    // 5. Create Job Record
    const job: DataOperationJob = await this.quotaService.withConcurrentSlot(organizationId, () =>
      this.prisma.dataOperationJob.create({
        data: {
        organizationId,
        operationKey,
        operationType: DataOperationType.EXPORT,
        status: DataOperationStatus.PROCESSING,
        format: exportFormatEnum,
        idempotencyKey: params.idempotencyKey,
        createdById: actorUserId,
        parameters: {
          fields: selectedFields,
          filters: params.filters as any,
          limit: effectiveLimit,
        },
        startedAt: new Date(),
        },
      }),
    );

    // 6. Handle Async vs Sync
    if (params.async) {
      await this.jobService.createJob(
        organizationId,
        {
          jobType: 'execute_data_export',
          payload: { jobId: job.id, params },
        },
        actorUserId,
      );
      await this.prisma.dataOperationJob.update({
        where: { id: job.id },
        data: { status: DataOperationStatus.QUEUED },
      });
      const queuedResult = { jobId: job.id, status: DataOperationStatus.QUEUED };
      if (idempotencyStarted && params.idempotencyKey) {
        await this.idempotency!.complete(
          organizationId,
          params.idempotencyKey,
          202,
          queuedResult,
          'data_operation_job',
          job.id,
        );
      }
      return queuedResult;
    }

    // 7. Synchronous execution
    try {
      const result = await this.executeExportCore(
        job,
        def,
        selectedFields,
        params.filters,
        effectiveLimit,
        format,
      );
      const durationMs = Date.now() - startTime;

      // Update job to COMPLETED
      await this.prisma.dataOperationJob.update({
        where: { id: job.id },
        data: {
          status: DataOperationStatus.COMPLETED,
          totalRows: result.rowCount,
          processedRows: result.rowCount,
          successfulRows: result.rowCount,
          fileName: result.fileName,
          fileSize: result.fileSizeBytes,
          completedAt: new Date(),
          resultSummary: {
            durationMs,
            rowCount: result.rowCount,
            fileSizeBytes: result.fileSizeBytes,
            fileContent: result.fileContent,
          },
        },
      });

      // Audit log (INV-548)
      await this.audit.record({
        action: 'data_operations.export.completed',
        resource: 'data_operations',
        eventName: 'data_operations.export.completed',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        details: {
          jobId: job.id,
          operationKey,
          rowCount: result.rowCount,
          durationMs,
          format,
        },
      });

      // Notification (INV-547)
      const updatedJob = await this.prisma.dataOperationJob.findUniqueOrThrow({
        where: { id: job.id },
      });
      await this.notificationService.notifyJobCompletion(updatedJob);

      const exportResult = {
        jobId: job.id,
        operationKey,
        format,
        rowCount: result.rowCount,
        fileContent: result.fileContent,
        fileName: result.fileName,
        fileSizeBytes: result.fileSizeBytes,
        durationMs,
      };
      if (idempotencyStarted && params.idempotencyKey) {
        await this.idempotency!.complete(
          organizationId,
          params.idempotencyKey,
          200,
          exportResult,
          'data_operation_job',
          job.id,
        );
      }
      return exportResult;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (idempotencyStarted && params.idempotencyKey) {
        await this.idempotency!.fail(organizationId, params.idempotencyKey, errMsg);
      }
      await this.prisma.dataOperationJob.update({
        where: { id: job.id },
        data: {
          status: DataOperationStatus.FAILED,
          errorSummary: errMsg,
          completedAt: new Date(),
        },
      });
      await this.notificationService.notifyJobFailure(job, errMsg);
      throw err;
    }
  }

  /**
   * Internal core query and serialization logic.
   * Parameterized Prisma query with strictly enforced tenant scoping (INV-528).
   */
  private async executeExportCore(
    job: DataOperationJob,
    def: any,
    fields: string[],
    filters?: Record<string, unknown>,
    limit: number = 1000,
    format: 'CSV' | 'JSON' = 'CSV',
  ): Promise<{
    rowCount: number;
    fileContent: string;
    fileName: string;
    fileSizeBytes: number;
  }> {
    const delegate = (this.prisma as any)[def.modelName];
    if (!delegate || typeof delegate.findMany !== 'function') {
      throw new BadRequestException(
        `Underlying entity model "${def.modelName}" cannot be accessed for export.`,
      );
    }

    // INV-528: Strict tenant isolation in where clause
    const where: Record<string, unknown> = {
      organizationId: job.organizationId,
    };

    // Apply safe filters (only matching allowlisted field names)
    if (filters && typeof filters === 'object') {
      for (const [key, val] of Object.entries(filters)) {
        if (def.fieldSchema.some((f: any) => f.name === key)) {
          where[key] = val;
        }
      }
    }

    // Select projection
    const select: Record<string, boolean> = {};
    for (const field of fields) {
      select[field] = true;
    }

    // Deterministic sorting (INV-512 / INV-534)
    const primaryIdentity = def.identityStrategy[0] || 'id';
    const orderBy = { [primaryIdentity]: 'asc' };

    const records = await delegate.findMany({
      where,
      select,
      take: limit,
      orderBy,
    });

    // Serialize
    const fileName = `${FileSecurityUtil.sanitizeFilename(def.entity)}_${job.id.slice(0, 8)}.${format.toLowerCase()}`;
    let fileContent = '';

    if (format === 'JSON') {
      fileContent = JSON.stringify(records, null, 2);
    } else {
      fileContent = this.serializeToCsv(records, fields);
    }

    const fileSizeBytes = Buffer.byteLength(fileContent, 'utf-8');

    // Enforce size limits (INV-535)
    FileSecurityUtil.enforceLimits({
      fileSizeBytes,
      maxFileSize: def.maxFileSize,
      totalRows: records.length,
      maxRows: def.maxRows,
      columnCount: fields.length,
      maxColumns: def.maxColumns,
    });

    return {
      rowCount: records.length,
      fileContent,
      fileName,
      fileSizeBytes,
    };
  }

  /**
   * RFC 4180 CSV serialization with spreadsheet formula injection protection.
   * INV-534: Cells starting with =, +, -, @, \t, \r are sanitized.
   */
  private serializeToCsv(
    records: Record<string, unknown>[],
    fields: string[],
  ): string {
    const headerRow = fields.map((f) => this.escapeCsvCell(f)).join(',');
    const rows = [headerRow];

    for (const record of records) {
      const row = fields.map((field) => {
        let val = record[field];
        if (val instanceof Date) {
          val = val.toISOString();
        } else if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        // Formula injection protection
        const sanitized = FileSecurityUtil.sanitizeFormulaInjection(val);
        return this.escapeCsvCell(sanitized);
      });
      rows.push(row.join(','));
    }

    return rows.join('\r\n');
  }

  private escapeCsvCell(val: string): string {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }
}
