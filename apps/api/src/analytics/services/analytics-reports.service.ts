import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsUsageRepository } from '../repositories/analytics-usage.repository';
import { SavedReportsRepository } from '../repositories/saved-reports.repository';
import { DashboardsRepository } from '../repositories/dashboards.repository';
import { ReportSchedulesRepository } from '../repositories/report-schedules.repository';
import { ReportExecutionStatus } from '@prisma/client';

@Injectable()
export class AnalyticsReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageRepo: AnalyticsUsageRepository,
    private readonly savedReportsRepo: SavedReportsRepository,
    private readonly dashboardsRepo: DashboardsRepository,
    private readonly schedulesRepo: ReportSchedulesRepository,
  ) {}

  /**
   * 1. Analytics Usage Overview
   */
  async getUsageOverview(organizationId: string) {
    const [totalReports, totalDashboards, totalSchedules, recentEvents] =
      await Promise.all([
        this.savedReportsRepo.countByOrganization(organizationId),
        this.dashboardsRepo.countByOrganization(organizationId),
        this.schedulesRepo.countByOrganization(organizationId),
        this.usageRepo.listEvents({ organizationId, limit: 100 }),
      ]);

    const totalQueries = recentEvents.events.filter(
      (e) => e.eventType === 'analytics.query.executed',
    ).length;

    return {
      organizationId,
      totalReports,
      totalDashboards,
      totalSchedules,
      totalQueriesInSample: totalQueries,
      recentActivityCount: recentEvents.total,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 2. Report Execution Performance
   */
  async getExecutionPerformance(organizationId: string) {
    const executions = await this.prisma.reportExecution.findMany({
      where: { organizationId },
      take: 100,
      orderBy: { executedAt: 'desc' },
    });

    const completed = executions.filter(
      (e) => e.status === ReportExecutionStatus.COMPLETED,
    );
    const failed = executions.filter(
      (e) => e.status === ReportExecutionStatus.FAILED,
    );
    const avgDuration =
      completed.length > 0
        ? Math.round(
            completed.reduce((acc, curr) => acc + curr.durationMs, 0) /
              completed.length,
          )
        : 0;

    return {
      organizationId,
      totalExecutions: executions.length,
      completedCount: completed.length,
      failedCount: failed.length,
      avgDurationMs: avgDuration,
      successRate:
        executions.length > 0
          ? Math.round((completed.length / executions.length) * 10000) / 100
          : 100,
      recentExecutions: executions.slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 3. Popular Reports & Dashboards
   */
  async getPopularResources(organizationId: string) {
    const [reports, dashboards] = await Promise.all([
      this.prisma.savedReport.findMany({
        where: { organizationId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, definitionKey: true, updatedAt: true },
      }),
      this.prisma.dashboard.findMany({
        where: { organizationId },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, name: true, updatedAt: true },
      }),
    ]);

    return {
      organizationId,
      topReports: reports,
      topDashboards: dashboards,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 4. Slow Queries & Heavy Aggregations
   */
  async getSlowQueries(organizationId: string) {
    const slowEvents = await this.prisma.analyticsUsageEvent.findMany({
      where: {
        organizationId,
        eventType: 'analytics.query.executed',
        durationMs: { gte: 200 },
      },
      take: 20,
      orderBy: { durationMs: 'desc' },
    });

    return {
      organizationId,
      slowQueryCount: slowEvents.length,
      thresholdMs: 200,
      queries: slowEvents,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 5. Export Volume & Delivery
   */
  async getExportVolume(organizationId: string) {
    const exportEvents = await this.prisma.analyticsUsageEvent.findMany({
      where: {
        organizationId,
        eventType: 'analytics.export.executed',
      },
      take: 50,
      orderBy: { occurredAt: 'desc' },
    });

    const totalRowsExported = exportEvents.reduce(
      (acc, curr) => acc + curr.rowCount,
      0,
    );

    return {
      organizationId,
      totalExports: exportEvents.length,
      totalRowsExported,
      recentExports: exportEvents.slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 6. Schedule Execution Reliability
   */
  async getScheduleReliability(organizationId: string) {
    const schedules = await this.prisma.reportSchedule.findMany({
      where: { organizationId },
      include: { savedReport: true },
    });

    return {
      organizationId,
      activeSchedulesCount: schedules.filter((s) => s.isActive).length,
      inactiveSchedulesCount: schedules.filter((s) => !s.isActive).length,
      schedules: schedules.map((s) => ({
        id: s.id,
        reportName: s.savedReport?.name,
        frequency: s.frequency,
        isActive: s.isActive,
        lastRunAt: s.lastRunAt,
        nextRunAt: s.nextRunAt,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 7. Domain Dataset Utilization
   */
  async getDatasetUtilization(organizationId: string) {
    const reports = await this.prisma.savedReport.findMany({
      where: { organizationId },
      select: { definitionKey: true },
    });

    const counts: Record<string, number> = {};
    for (const r of reports) {
      counts[r.definitionKey] = (counts[r.definitionKey] || 0) + 1;
    }

    return {
      organizationId,
      datasetCounts: counts,
      totalReportsSurveyed: reports.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 8. Access & Sharing Security Audit
   */
  async getSecurityAudit(organizationId: string) {
    const [reportShares, dashboardShares] = await Promise.all([
      this.prisma.reportShare.findMany({
        where: { organizationId },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dashboardShare.findMany({
        where: { organizationId },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      organizationId,
      totalReportShares: reportShares.length,
      totalDashboardShares: dashboardShares.length,
      recentReportShares: reportShares.slice(0, 10),
      recentDashboardShares: dashboardShares.slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }
}
