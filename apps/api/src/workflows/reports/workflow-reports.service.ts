import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryWorkflowReportsDto } from './dto/query-reports.dto';

@Injectable()
export class WorkflowReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(dto: QueryWorkflowReportsDto): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date();
    const days = dto.days || 30;
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
  }

  /**
   * Report 1: Workflow Operations Overview
   */
  async getOverviewReport(
    organizationId: string,
    dto: QueryWorkflowReportsDto,
  ) {
    const { startDate, endDate } = this.getDateRange(dto);

    const [
      totalDefinitions,
      activeDefinitions,
      totalExecutions,
      completedExecutions,
      failedExecutions,
      waitingExecutions,
      pendingApprovals,
      activeSchedules,
    ] = await Promise.all([
      this.prisma.workflowDefinition.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.workflowDefinition.count({
        where: { organizationId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.workflowExecution.count({
        where: { organizationId, createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.workflowExecution.count({
        where: {
          organizationId,
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.workflowExecution.count({
        where: {
          organizationId,
          status: 'FAILED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.workflowExecution.count({
        where: {
          organizationId,
          status: 'WAITING',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.workflowApproval.count({
        where: {
          organizationId,
          status: 'PENDING',
        },
      }),
      this.prisma.workflowSchedule.count({
        where: { organizationId, status: 'ACTIVE' },
      }),
    ]);

    const successRate =
      totalExecutions > 0
        ? Math.round((completedExecutions / totalExecutions) * 10000) / 100
        : 100;

    return {
      period: { startDate, endDate },
      totalDefinitions,
      activeDefinitions,
      totalExecutions,
      completedExecutions,
      failedExecutions,
      waitingExecutions,
      successRate,
      pendingApprovals,
      activeSchedules,
    };
  }

  /**
   * Report 2: Success / Failure Rate Analysis
   */
  async getSuccessFailureReport(
    organizationId: string,
    dto: QueryWorkflowReportsDto,
  ) {
    const { startDate, endDate } = this.getDateRange(dto);

    const executions = await this.prisma.workflowExecution.groupBy({
      by: ['status'],
      where: {
        organizationId,
        ...(dto.workflowDefinitionId
          ? { workflowDefinitionId: dto.workflowDefinitionId }
          : {}),
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const item of executions) {
      statusCounts[item.status] = item._count.id;
      total += item._count.id;
    }

    const completed = statusCounts['COMPLETED'] || 0;
    const failed = statusCounts['FAILED'] || 0;
    const cancelled = statusCounts['CANCELLED'] || 0;
    const timedOut = statusCounts['TIMED_OUT'] || 0;
    const running = statusCounts['RUNNING'] || 0;
    const waiting = statusCounts['WAITING'] || 0;

    return {
      period: { startDate, endDate },
      total,
      breakdown: {
        completed,
        failed,
        cancelled,
        timedOut,
        running,
        waiting,
      },
      successRate:
        total > 0 ? Math.round((completed / total) * 10000) / 100 : 100,
      failureRate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
    };
  }

  /**
   * Report 3: Execution Performance & Latency
   */
  async getPerformanceReport(
    organizationId: string,
    dto: QueryWorkflowReportsDto,
  ) {
    const { startDate, endDate } = this.getDateRange(dto);

    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        organizationId,
        ...(dto.workflowDefinitionId
          ? { workflowDefinitionId: dto.workflowDefinitionId }
          : {}),
        status: 'COMPLETED',
        startedAt: { not: null },
        completedAt: { not: null },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        startedAt: true,
        completedAt: true,
        workflowDefinitionId: true,
      },
      take: 1000,
    });

    if (executions.length === 0) {
      return {
        period: { startDate, endDate },
        sampleCount: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
      };
    }

    const durations = executions
      .map((e) =>
        Math.max(
          0,
          new Date(e.completedAt!).getTime() - new Date(e.startedAt!).getTime(),
        ),
      )
      .sort((a, b) => a - b);

    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / durations.length);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    return {
      period: { startDate, endDate },
      sampleCount: durations.length,
      avgDurationMs: avg,
      minDurationMs: durations[0],
      maxDurationMs: durations[durations.length - 1],
      p50DurationMs: p50,
      p95DurationMs: p95,
      p99DurationMs: p99,
    };
  }

  /**
   * Report 4: Execution Failures & Error Breakdown
   */
  async getFailuresReport(
    organizationId: string,
    dto: QueryWorkflowReportsDto,
  ) {
    const { startDate, endDate } = this.getDateRange(dto);

    const failedExecutions = await this.prisma.workflowExecution.findMany({
      where: {
        organizationId,
        status: 'FAILED',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        workflowDefinitionId: true,
        errorCode: true,
        errorMessage: true,
        completedAt: true,
        workflowDefinition: {
          select: { name: true, key: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    const errorCounts: Record<string, number> = {};
    for (const item of failedExecutions) {
      const code = item.errorCode || 'UNKNOWN_ERROR';
      errorCounts[code] = (errorCounts[code] || 0) + 1;
    }

    return {
      period: { startDate, endDate },
      totalFailures: failedExecutions.length,
      errorBreakdown: errorCounts,
      recentFailures: failedExecutions.map((e) => ({
        id: e.id,
        workflowKey: e.workflowDefinition?.key,
        workflowName: e.workflowDefinition?.name,
        errorCode: e.errorCode,
        errorMessage: e.errorMessage,
        failedAt: e.completedAt,
      })),
    };
  }

  /**
   * Report 5: Approval Queue & Backlog
   */
  async getApprovalQueueReport(organizationId: string) {
    const pendingApprovals = await this.prisma.workflowApproval.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
      include: {
        execution: {
          select: {
            id: true,
            workflowDefinition: { select: { name: true, key: true } },
          },
        },
        actions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const items = pendingApprovals.map((app) => {
      const ageHours = Math.round(
        (now.getTime() - new Date(app.createdAt).getTime()) / (1000 * 60 * 60),
      );
      const isOverdue = app.expiresAt ? new Date(app.expiresAt) < now : false;
      const isEscalationDue = app.escalateAt
        ? new Date(app.escalateAt) < now
        : false;

      const approvalCount = app.actions.filter(
        (a) => a.decision === 'APPROVED',
      ).length;
      const rejectionCount = app.actions.filter(
        (a) => a.decision === 'REJECTED',
      ).length;

      return {
        id: app.id,
        nodeId: app.nodeId,
        workflowName: app.execution?.workflowDefinition?.name,
        workflowKey: app.execution?.workflowDefinition?.key,
        executionId: app.executionId,
        approvalType: app.approvalType,
        approverType: app.approverType,
        approverTarget: app.approverTarget,
        minimumApprovals: app.minimumApprovals,
        approvalCount,
        rejectionCount,
        requestedAt: app.createdAt,
        expiresAt: app.expiresAt,
        escalateAt: app.escalateAt,
        escalatedTo: app.escalatedTo,
        ageHours,
        isOverdue,
        isEscalationDue,
      };
    });

    return {
      totalPending: items.length,
      overdueCount: items.filter((i) => i.isOverdue).length,
      escalationDueCount: items.filter((i) => i.isEscalationDue).length,
      items,
    };
  }

  /**
   * Report 6: Approval SLA & Latency Analysis
   */
  async getApprovalSlaReport(
    organizationId: string,
    dto: QueryWorkflowReportsDto,
  ) {
    const { startDate, endDate } = this.getDateRange(dto);

    const completedApprovals = await this.prisma.workflowApproval.findMany({
      where: {
        organizationId,
        status: { in: ['APPROVED', 'REJECTED'] },
        resolvedAt: { not: null, gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        approvalType: true,
      },
    });

    const latenciesMinutes = completedApprovals
      .filter((a) => a.resolvedAt)
      .map((a) => {
        const diff =
          new Date(a.resolvedAt!).getTime() - new Date(a.createdAt).getTime();
        return Math.max(0, Math.round(diff / (1000 * 60)));
      })
      .sort((a, b) => a - b);

    const total = latenciesMinutes.length;
    const avgMinutes =
      total > 0
        ? Math.round(latenciesMinutes.reduce((a, b) => a + b, 0) / total)
        : 0;
    const p50 = total > 0 ? latenciesMinutes[Math.floor(total * 0.5)] : 0;
    const p95 = total > 0 ? latenciesMinutes[Math.floor(total * 0.95)] : 0;

    return {
      period: { startDate, endDate },
      totalDecided: total,
      approvedCount: completedApprovals.filter((a) => a.status === 'APPROVED')
        .length,
      rejectedCount: completedApprovals.filter((a) => a.status === 'REJECTED')
        .length,
      avgResolutionMinutes: avgMinutes,
      p50ResolutionMinutes: p50,
      p95ResolutionMinutes: p95,
    };
  }

  /**
   * Report 7: Action Execution Failures & Retries
   */
  async getActionFailuresReport(
    organizationId: string,
    dto: QueryWorkflowReportsDto,
  ) {
    const { startDate, endDate } = this.getDateRange(dto);

    const failedSteps = await this.prisma.workflowExecutionStep.findMany({
      where: {
        execution: { organizationId },
        status: 'FAILED',
        node: { nodeType: 'ACTION' },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        errorMessage: true,
        executionId: true,
        createdAt: true,
        node: {
          select: {
            nodeKey: true,
            label: true,
            actions: {
              select: { actionType: true },
            },
          },
        },
      },
      take: 100,
    });

    const actionTypeCounts: Record<string, number> = {};
    for (const step of failedSteps) {
      const type = step.node?.actions?.[0]?.actionType || 'UNKNOWN';
      actionTypeCounts[type] = (actionTypeCounts[type] || 0) + 1;
    }

    return {
      period: { startDate, endDate },
      totalActionFailures: failedSteps.length,
      failuresByActionType: actionTypeCounts,
      recentActionErrors: failedSteps.slice(0, 20),
    };
  }

  /**
   * Report 8: Rule Evaluation Performance & Statistics
   */
  async getRuleEvaluationsReport(organizationId: string) {
    const rules = await this.prisma.workflowRule.findMany({
      where: {
        workflowVersion: {
          workflowDefinition: { organizationId },
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const conditionSteps = await this.prisma.workflowExecutionStep.count({
      where: {
        execution: { organizationId },
        node: { nodeType: 'CONDITION' },
      },
    });

    return {
      totalConfiguredRules: rules.length,
      totalRuleInvocations: conditionSteps,
      rulesSummary: rules.map((r) => ({
        id: r.id,
        name: r.name,
        updatedAt: r.updatedAt,
      })),
    };
  }

  /**
   * Report 9: Scheduled Trigger Drift & Reliability
   */
  async getSchedulesReport(organizationId: string) {
    const schedules = await this.prisma.workflowSchedule.findMany({
      where: { organizationId },
      include: {
        workflowDefinition: {
          select: { name: true, key: true },
        },
      },
      orderBy: { nextRunAt: 'asc' },
    });

    return {
      totalSchedules: schedules.length,
      activeCount: schedules.filter((s) => s.status === 'ACTIVE').length,
      pausedCount: schedules.filter((s) => s.status === 'PAUSED').length,
      schedules: schedules.map((s) => ({
        id: s.id,
        workflowKey: s.workflowDefinition.key,
        workflowName: s.workflowDefinition.name,
        scheduleType: s.scheduleType,
        cronExpression: s.cronExpression,
        intervalSeconds: s.intervalSeconds,
        timezone: s.timezone,
        status: s.status,
        lastRunAt: s.lastRunAt,
        nextRunAt: s.nextRunAt,
      })),
    };
  }

  /**
   * Report 10: Workflow Adoption & Utilization
   */
  async getAdoptionReport(
    organizationId: string,
    dto: QueryWorkflowReportsDto,
  ) {
    const { startDate, endDate } = this.getDateRange(dto);

    const definitions = await this.prisma.workflowDefinition.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        _count: {
          select: {
            executions: true,
            versions: true,
            triggers: true,
          },
        },
      },
    });

    const executionsInPeriod = await this.prisma.workflowExecution.groupBy({
      by: ['workflowDefinitionId'],
      where: {
        organizationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    const periodCountMap = new Map<string, number>();
    for (const e of executionsInPeriod) {
      periodCountMap.set(e.workflowDefinitionId, e._count.id);
    }

    return {
      period: { startDate, endDate },
      totalWorkflows: definitions.length,
      activeWorkflows: definitions.filter((d) => d.status === 'ACTIVE').length,
      workflows: definitions.map((d) => ({
        id: d.id,
        key: d.key,
        name: d.name,
        category: d.category,
        status: d.status,
        versionCount: d._count.versions,
        triggerCount: d._count.triggers,
        allTimeExecutions: d._count.executions,
        periodExecutions: periodCountMap.get(d.id) || 0,
      })),
    };
  }
}
