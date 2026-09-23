import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ReportSchedulesRepository } from '../repositories/report-schedules.repository';
import { SavedReportsService } from './saved-reports.service';
import { ReportExecutionService } from './report-execution.service';
import {
  CreateReportScheduleDto,
  UpdateReportScheduleDto,
} from '../dto/report-schedule.dto';
import { ReportSchedule, ReportScheduleFrequency } from '@prisma/client';
import { JobService } from '../../common/jobs/job.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ReportSchedulingService implements OnModuleInit {
  private readonly logger = new Logger(ReportSchedulingService.name);

  constructor(
    private readonly schedulesRepo: ReportSchedulesRepository,
    private readonly savedReportsService: SavedReportsService,
    private readonly executionService: ReportExecutionService,
    @Optional() private readonly jobService?: JobService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  onModuleInit() {
    if (this.jobService) {
      try {
        this.jobService.registerHandler(
          'execute_scheduled_report',
          async (payload: { scheduleId: string; organizationId: string }) => {
            await this.processScheduledReport(
              payload.scheduleId,
              payload.organizationId,
            );
          },
        );
        this.logger.log(
          'Registered execute_scheduled_report handler with JobService (M36)',
        );
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to register scheduled report job handler: ${String(err)}`,
        );
      }
    }
  }

  /**
   * Creates a schedule for automated report generation (INV-518, INV-525).
   */
  async createSchedule(params: {
    organizationId: string;
    userId?: string;
    userPermissions?: string[];
    dto: CreateReportScheduleDto;
  }): Promise<ReportSchedule> {
    const { organizationId, userId, userPermissions, dto } = params;

    if (!organizationId) {
      throw new BadRequestException(
        'Tenant configuration must belong to exactly one organization (INV-502)',
      );
    }

    // INV-518: Scheduled reports reference valid authorized reports
    const report = await this.savedReportsService.getReport({
      id: dto.savedReportId,
      organizationId,
      userId,
      userPermissions,
    });

    if (!report) {
      throw new NotFoundException(
        `Saved report "${dto.savedReportId}" not found or unauthorized (INV-518)`,
      );
    }

    const nextRunAt = this.calculateNextRun(dto.frequency, dto.cronExpression);

    const created = await this.schedulesRepo.create(organizationId, {
      savedReport: { connect: { id: dto.savedReportId } },
      frequency: dto.frequency,
      cronExpression: dto.cronExpression,
      recipients: dto.recipients ?? [],
      channels: dto.channels ?? ['IN_APP'],
      exportFormat: dto.exportFormat,
      isActive: dto.isActive ?? true,
      nextRunAt,
    });

    await this.auditService?.record({
      eventName: 'analytics.schedule.create',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.schedule.create',
      resource: 'ReportSchedule',
      resourceId: created.id,
      details: { savedReportId: dto.savedReportId, frequency: dto.frequency },
    });

    return created;
  }

  /**
   * Retrieves a schedule.
   */
  async getSchedule(
    id: string,
    organizationId: string,
  ): Promise<ReportSchedule> {
    const schedule = await this.schedulesRepo.findById(id, organizationId);
    if (!schedule) {
      throw new NotFoundException(
        `Report schedule "${id}" not found (INV-510)`,
      );
    }
    return schedule;
  }

  /**
   * Lists schedules for tenant.
   */
  async listSchedules(organizationId: string): Promise<ReportSchedule[]> {
    return this.schedulesRepo.listSchedules(organizationId);
  }

  /**
   * Updates a report schedule (INV-525).
   */
  async updateSchedule(params: {
    id: string;
    organizationId: string;
    userId?: string;
    dto: UpdateReportScheduleDto;
  }): Promise<ReportSchedule> {
    const { id, organizationId, userId, dto } = params;
    const existing = await this.getSchedule(id, organizationId);

    const frequency = dto.frequency ?? existing.frequency;
    const cron = dto.cronExpression ?? existing.cronExpression;
    const nextRunAt = dto.frequency
      ? this.calculateNextRun(frequency, cron ?? undefined)
      : undefined;

    const updated = await this.schedulesRepo.update(id, organizationId, {
      frequency: dto.frequency,
      cronExpression: dto.cronExpression,
      recipients: dto.recipients,
      channels: dto.channels,
      exportFormat: dto.exportFormat,
      isActive: dto.isActive,
      ...(nextRunAt ? { nextRunAt } : {}),
    });

    await this.auditService?.record({
      eventName: 'analytics.schedule.update',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.schedule.update',
      resource: 'ReportSchedule',
      resourceId: id,
      details: { frequency: updated.frequency },
    });

    return updated;
  }

  /**
   * Deletes a report schedule (INV-525).
   */
  async deleteSchedule(
    id: string,
    organizationId: string,
    userId?: string,
  ): Promise<ReportSchedule> {
    await this.getSchedule(id, organizationId);
    const deleted = await this.schedulesRepo.delete(id, organizationId);

    await this.auditService?.record({
      eventName: 'analytics.schedule.delete',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.schedule.delete',
      resource: 'ReportSchedule',
      resourceId: id,
    });

    return deleted;
  }

  /**
   * Processes a due scheduled report: executes report and advances nextRunAt.
   * Dispatches notifications strictly using M43 policies (INV-524).
   */
  async processScheduledReport(
    scheduleId: string,
    organizationId: string,
  ): Promise<void> {
    const schedule = await this.schedulesRepo.findById(
      scheduleId,
      organizationId,
    );
    if (!schedule || !schedule.isActive) {
      return;
    }

    try {
      const { execution } = await this.executionService.executeSavedReport({
        savedReportId: schedule.savedReportId,
        organizationId,
        userPermissions: ['analytics.admin'],
        executionId: `sched-${scheduleId}-${Date.now()}`,
      });

      const nextRunAt = this.calculateNextRun(
        schedule.frequency,
        schedule.cronExpression ?? undefined,
      );

      await this.schedulesRepo.update(schedule.id, organizationId, {
        lastRunAt: new Date(),
        nextRunAt,
      });

      // INV-524: Analytics notifications use M43 policies and cannot bypass communication controls
      if (
        schedule.recipients &&
        schedule.recipients.length > 0 &&
        this.notificationsService
      ) {
        for (const recipient of schedule.recipients) {
          try {
            await this.notificationsService.notify(organizationId, {
              eventType: 'analytics.report.scheduled',
              title: `Scheduled Report Completed`,
              content: `Scheduled execution for report ${schedule.savedReportId} completed successfully with ${execution.rowCount} rows.`,
              recipientDestinations: [recipient],
              idempotencyKey: `report-sched-${schedule.id}-${execution.id}-${recipient}`,
            });
          } catch (notifyErr: unknown) {
            this.logger.warn(
              `Failed to dispatch M43 notification to ${recipient}: ${String(notifyErr)}`,
            );
          }
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `Error processing scheduled report ${scheduleId}: ${String(err)}`,
      );
    }
  }

  /**
   * Computes the next run date based on frequency.
   */
  public calculateNextRun(
    frequency: ReportScheduleFrequency,
    cronExpression?: string,
  ): Date {
    void cronExpression;
    const now = new Date();
    switch (frequency) {
      case ReportScheduleFrequency.DAILY: {
        const next = new Date(now);
        next.setUTCDate(next.getUTCDate() + 1);
        next.setUTCHours(0, 0, 0, 0);
        return next;
      }
      case ReportScheduleFrequency.WEEKLY: {
        const next = new Date(now);
        next.setUTCDate(next.getUTCDate() + 7);
        next.setUTCHours(0, 0, 0, 0);
        return next;
      }
      case ReportScheduleFrequency.MONTHLY: {
        const next = new Date(now);
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(1);
        next.setUTCHours(0, 0, 0, 0);
        return next;
      }
      case ReportScheduleFrequency.CUSTOM:
      default: {
        // Default 24 hours later
        const next = new Date(now);
        next.setUTCDate(next.getUTCDate() + 1);
        return next;
      }
    }
  }
}
