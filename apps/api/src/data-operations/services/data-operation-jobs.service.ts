import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  DataOperationJob,
  DataOperationStatus,
  DataOperationType,
  DataOperationError,
  DataOperationTemplate,
} from '@prisma/client';

export interface JobListQuery {
  status?: DataOperationStatus;
  operationType?: DataOperationType;
  operationKey?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class DataOperationJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Retrieves a job by ID strictly within the caller's tenant context.
   * INV-541: Cross-tenant job access is blocked.
   */
  async getJob(
    organizationId: string,
    jobId: string,
  ): Promise<DataOperationJob> {
    const job = await this.prisma.dataOperationJob.findFirst({
      where: { id: jobId, organizationId },
      include: {
        batches: { orderBy: { batchIndex: 'asc' } },
      },
    });

    if (!job) {
      throw new NotFoundException(
        `Data operation job "${jobId}" not found in this organization.`,
      );
    }

    return job;
  }

  /**
   * Lists jobs for the caller's tenant.
   * INV-541: Tenant-scoped job history.
   */
  async listJobs(
    organizationId: string,
    query?: JobListQuery,
  ): Promise<{ jobs: DataOperationJob[]; total: number }> {
    const where: any = { organizationId };

    if (query?.status) where.status = query.status;
    if (query?.operationType) where.operationType = query.operationType;
    if (query?.operationKey) where.operationKey = query.operationKey;

    const limit = Math.min(query?.limit ?? 50, 100);
    const offset = Math.max(query?.offset ?? 0, 0);

    const [jobs, total] = await Promise.all([
      this.prisma.dataOperationJob.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dataOperationJob.count({ where }),
    ]);

    return { jobs, total };
  }

  /**
   * Cancels an in-flight job.
   * INV-544 / INV-545: State machine protected cancellation.
   */
  async cancelJob(
    organizationId: string,
    jobId: string,
    actorUserId?: string,
  ): Promise<DataOperationJob> {
    const job = await this.getJob(organizationId, jobId);

    if (
      job.status === DataOperationStatus.COMPLETED ||
      job.status === DataOperationStatus.FAILED ||
      job.status === DataOperationStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Job "${jobId}" cannot be cancelled because it is already in terminal state "${job.status}".`,
      );
    }

    const updated = await this.prisma.dataOperationJob.update({
      where: { id: jobId },
      data: {
        status: DataOperationStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    await this.audit.record({
      action: 'data_operations.job.cancelled',
      resource: 'data_operations',
      eventName: 'data_operations.job.cancelled',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      details: { jobId, operationKey: job.operationKey },
    });

    return updated;
  }

  /**
   * Downloads result file content for completed export job.
   * INV-542: Result files are tenant-scoped and access-controlled.
   */
  async getJobResult(
    organizationId: string,
    jobId: string,
  ): Promise<{ fileContent: string; fileName: string; format: string }> {
    const job = await this.getJob(organizationId, jobId);

    if (job.status !== DataOperationStatus.COMPLETED) {
      throw new BadRequestException(
        `Result is not available for job in status "${job.status}".`,
      );
    }

    const summary = (job.resultSummary as any) || {};
    const fileContent = summary.fileContent || '';
    const fileName =
      job.fileName || `result_${job.id}.${job.format.toLowerCase()}`;

    return {
      fileContent,
      fileName,
      format: job.format,
    };
  }

  /**
   * Downloads row-level error report for a job.
   * INV-542 / INV-550: Error reports are tenant-scoped and sanitized.
   */
  async getJobErrors(
    organizationId: string,
    jobId: string,
  ): Promise<{ errors: DataOperationError[]; csvContent: string }> {
    // Assert job belongs to tenant (INV-541)
    await this.getJob(organizationId, jobId);

    const errors = await this.prisma.dataOperationError.findMany({
      where: { jobId, organizationId },
      orderBy: { rowNumber: 'asc' },
    });

    // Generate RFC 4180 CSV error report
    const headers = ['rowNumber', 'fieldName', 'errorCode', 'errorMessage'];
    const rows = [headers.join(',')];

    for (const err of errors) {
      rows.push(
        [
          err.rowNumber,
          `"${(err.fieldName || '').replace(/"/g, '""')}"`,
          `"${(err.errorCode || '').replace(/"/g, '""')}"`,
          `"${(err.errorMessage || '').replace(/"/g, '""')}"`,
        ].join(','),
      );
    }

    return {
      errors,
      csvContent: rows.join('\r\n'),
    };
  }

  /**
   * Template CRUD (INV-548)
   */
  async createTemplate(
    organizationId: string,
    dto: {
      operationKey: string;
      name: string;
      description?: string;
      fieldMappings?: Record<string, string>;
      defaultParameters?: Record<string, unknown>;
    },
    actorUserId?: string,
  ): Promise<DataOperationTemplate> {
    const template = await this.prisma.dataOperationTemplate.create({
      data: {
        organizationId,
        operationKey: dto.operationKey,
        name: dto.name,
        description: dto.description,
        fieldMappings: dto.fieldMappings as any,
        defaultParameters: dto.defaultParameters as any,
        createdById: actorUserId,
      },
    });

    await this.audit.record({
      action: 'data_operations.template.created',
      resource: 'data_operations',
      eventName: 'data_operations.template.created',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      details: { templateId: template.id, name: template.name },
    });

    return template;
  }

  async listTemplates(
    organizationId: string,
    operationKey?: string,
  ): Promise<DataOperationTemplate[]> {
    const where: any = { organizationId };
    if (operationKey) where.operationKey = operationKey;

    return this.prisma.dataOperationTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }
}
