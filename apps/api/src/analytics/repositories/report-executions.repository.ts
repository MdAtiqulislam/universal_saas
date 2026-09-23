import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ReportExecution, ReportExecutionStatus } from '@prisma/client';

@Injectable()
export class ReportExecutionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    organizationId: string;
    savedReportId?: string;
    executedByUserId?: string;
    executionId: string;
    status?: ReportExecutionStatus;
    rowCount?: number;
    durationMs?: number;
    errorMessage?: string;
    snapshotData?: Prisma.InputJsonValue;
  }): Promise<ReportExecution> {
    return this.prisma.reportExecution.create({
      data: {
        organization: { connect: { id: data.organizationId } },
        ...(data.savedReportId
          ? { savedReport: { connect: { id: data.savedReportId } } }
          : {}),
        executedByUserId: data.executedByUserId,
        executionId: data.executionId,
        status: data.status ?? ReportExecutionStatus.RUNNING,
        rowCount: data.rowCount ?? 0,
        durationMs: data.durationMs ?? 0,
        errorMessage: data.errorMessage,
        snapshotData: data.snapshotData,
      },
    });
  }

  async update(
    executionId: string,
    data: {
      status?: ReportExecutionStatus;
      rowCount?: number;
      durationMs?: number;
      errorMessage?: string;
      snapshotData?: Prisma.InputJsonValue;
    },
  ): Promise<ReportExecution> {
    return this.prisma.reportExecution.update({
      where: { executionId },
      data,
    });
  }

  async findByExecutionId(
    executionId: string,
    organizationId: string,
  ): Promise<ReportExecution | null> {
    return this.prisma.reportExecution.findFirst({
      where: {
        executionId,
        organizationId,
      },
      include: {
        savedReport: true,
      },
    });
  }

  async listExecutions(params: {
    organizationId: string;
    savedReportId?: string;
    userId?: string;
    status?: ReportExecutionStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ executions: ReportExecution[]; total: number }> {
    const {
      organizationId,
      savedReportId,
      userId,
      status,
      limit = 50,
      offset = 0,
    } = params;

    const where: Prisma.ReportExecutionWhereInput = {
      organizationId,
      ...(savedReportId ? { savedReportId } : {}),
      ...(userId ? { executedByUserId: userId } : {}),
      ...(status ? { status } : {}),
    };

    const [executions, total] = await Promise.all([
      this.prisma.reportExecution.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { executedAt: 'desc' },
      }),
      this.prisma.reportExecution.count({ where }),
    ]);

    return { executions, total };
  }
}
