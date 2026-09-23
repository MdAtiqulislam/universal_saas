import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ReportExecutionsRepository } from '../repositories/report-executions.repository';
import { SavedReportsService } from './saved-reports.service';
import {
  AnalyticsQueryEngineService,
  AnalyticsQueryResult,
} from './analytics-query-engine.service';
import { TimeGranularity } from './time-analytics.service';
import { MeasureQueryItem, FilterNode } from '../dto/analytics-query.dto';
import { ReportExecution, ReportExecutionStatus, Prisma } from '@prisma/client';

@Injectable()
export class ReportExecutionService {
  private readonly logger = new Logger(ReportExecutionService.name);

  constructor(
    private readonly executionsRepo: ReportExecutionsRepository,
    private readonly savedReportsService: SavedReportsService,
    private readonly queryEngine: AnalyticsQueryEngineService,
  ) {}

  /**
   * Executes a saved report and tracks the execution lifecycle (INV-517, INV-519).
   * Supports idempotent execution if executionId is supplied by scheduler/caller.
   */
  async executeSavedReport(params: {
    savedReportId: string;
    organizationId: string;
    userId?: string;
    userPermissions?: string[];
    executionId?: string;
  }): Promise<{ execution: ReportExecution; result: AnalyticsQueryResult }> {
    const {
      savedReportId,
      organizationId,
      userId,
      userPermissions,
      executionId: customExecutionId,
    } = params;

    // INV-519: Report executions are idempotent where retryable scheduling can duplicate execution
    if (customExecutionId) {
      const existing = await this.executionsRepo.findByExecutionId(
        customExecutionId,
        organizationId,
      );
      if (
        existing &&
        (existing.status === ReportExecutionStatus.COMPLETED ||
          existing.status === ReportExecutionStatus.RUNNING)
      ) {
        this.logger.log(
          `Idempotent execution hit for executionId: ${customExecutionId}, status: ${existing.status}`,
        );
        return {
          execution: existing,
          result: {
            data: Array.isArray(existing.snapshotData)
              ? (existing.snapshotData as unknown as Record<string, unknown>[])
              : [],
            meta: {
              definitionKey: 'saved.report',
              dimensions: [],
              measures: [],
              totalRows: existing.rowCount,
              executionTimeMs: existing.durationMs,
              timeZone: 'UTC',
              limit: 50,
              offset: 0,
            },
            cacheHit: true,
          },
        };
      }
    }

    const executionId = customExecutionId ?? randomUUID();
    const startTime = Date.now();

    // Revalidates saved report against current definitions and access rules (INV-516, INV-517)
    const report = await this.savedReportsService.getReport({
      id: savedReportId,
      organizationId,
      userId,
      userPermissions,
    });

    // Record initial RUNNING execution
    await this.executionsRepo.create({
      organizationId,
      savedReportId,
      executedByUserId: userId,
      executionId,
      status: ReportExecutionStatus.RUNNING,
    });

    try {
      const result = await this.queryEngine.execute({
        organizationId,
        userId,
        userPermissions,
        query: {
          definitionKey: report.definitionKey,
          dimensions: report.dimensions,
          measures: (report.measures as unknown as MeasureQueryItem[]) ?? [],
          filterAst: (report.filterAst as unknown as FilterNode) ?? undefined,
          timeDimension: report.timeDimension ?? undefined,
          timeGranularity:
            (report.timeGranularity as TimeGranularity) ?? undefined,
          timeZone: report.timeZone,
          limit: report.limit,
          offset: report.offset,
          sortBy: report.sortBy ?? undefined,
          sortDirection: (report.sortDirection as 'asc' | 'desc') ?? 'asc',
        },
      });

      const durationMs = Date.now() - startTime;
      const snapshot = result.data.slice(
        0,
        50,
      ) as unknown as Prisma.InputJsonValue;
      const updatedExecution = await this.executionsRepo.update(executionId, {
        status: ReportExecutionStatus.COMPLETED,
        rowCount: result.data.length,
        durationMs,
        snapshotData: snapshot,
      });

      return { execution: updatedExecution, result };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.executionsRepo.update(executionId, {
        status: ReportExecutionStatus.FAILED,
        durationMs,
        errorMessage,
      });

      this.logger.error(`Report execution failed: ${errorMessage}`);
      throw err;
    }
  }

  /**
   * Retrieves execution history with tenant and user scoping (INV-520).
   * Does not expose restricted payloads outside tenant or unauthorized scopes.
   */
  async getExecutionHistory(params: {
    organizationId: string;
    savedReportId?: string;
    userId?: string;
    status?: ReportExecutionStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ executions: ReportExecution[]; total: number }> {
    return this.executionsRepo.listExecutions(params);
  }
}
