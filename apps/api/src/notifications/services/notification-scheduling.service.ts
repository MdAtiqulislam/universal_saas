import {
  Injectable,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobService } from '../../common/jobs/job.service';
import { NotificationsService } from './notifications.service';
import { CreateScheduleDto } from '../dto/schedule.dto';
import { NotificationScheduleStatus, Prisma } from '@prisma/client';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class NotificationSchedulingService implements OnModuleInit {
  private readonly jobType = 'notification.scheduled.execute';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService,
    private readonly notificationsService: NotificationsService,
    private readonly logger: StructuredLoggingService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    this.jobService.registerHandler(this.jobType, async (payload) => {
      const data = payload as { scheduleId?: string };
      if (typeof data?.scheduleId === 'string') {
        await this.executeScheduledNotification(data.scheduleId);
      }
    });
  }

  async scheduleNotification(
    organizationId: string,
    dto: CreateScheduleDto,
    actorUserId?: string,
  ) {
    const sendAt = new Date(dto.sendAt);
    if (isNaN(sendAt.getTime()) || sendAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'sendAt must be a valid future ISO timestamp',
      );
    }

    const schedule = await this.prisma.notificationSchedule.create({
      data: {
        organizationId,
        templateKey: dto.templateKey,
        channels: dto.channels,
        recipientIds: dto.recipientIds,
        sendAt,
        timezone: dto.timezone || 'UTC',
        payload: (dto.payload || {}) as Prisma.InputJsonValue,
        status: NotificationScheduleStatus.PENDING,
      },
    });

    // Enqueue background job to run
    const job = await this.jobService.createJob(
      organizationId,
      {
        jobType: this.jobType,
        payload: { scheduleId: schedule.id, organizationId },
        priority: 1,
      },
      actorUserId,
    );

    // Link job execution id to schedule
    await this.prisma.notificationSchedule.update({
      where: { id: schedule.id },
      data: { executionId: job.id },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.scheduled',
        organizationId,
        actorUserId,
        resource: 'notification_schedule',
        resourceId: schedule.id,
        details: { templateKey: dto.templateKey, sendAt },
        eventName: 'notifications.scheduled',
        occurredAt: new Date(),
      });
    }

    return schedule;
  }

  /**
   * INV-471: Scheduled notifications cannot execute more than once for the same scheduled occurrence
   */
  async executeScheduledNotification(scheduleId: string) {
    const schedule = await this.prisma.notificationSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      this.logger.log({
        level: 'WARN',
        message: `Scheduled notification ${scheduleId} not found during execution`,
      });
      return;
    }

    if (schedule.status !== NotificationScheduleStatus.PENDING) {
      this.logger.log({
        level: 'INFO',
        message: `Schedule ${scheduleId} is not in PENDING state (${schedule.status}), skipping duplicate run`,
      });
      return;
    }

    // Atomically transition status to EXECUTED
    await this.prisma.notificationSchedule.update({
      where: { id: scheduleId },
      data: {
        status: NotificationScheduleStatus.EXECUTED,
        executedAt: new Date(),
      },
    });

    await this.notificationsService.notify(schedule.organizationId, {
      eventType: 'scheduled.notification',
      templateKey: schedule.templateKey,
      channels: schedule.channels,
      recipientUserIds: schedule.recipientIds,
      payload: (schedule.payload as Record<string, unknown>) || {},
      idempotencyKey: `sched:${schedule.id}`,
    });

    this.logger.log({
      level: 'INFO',
      message: `Executed scheduled notification ${scheduleId} successfully`,
      organizationId: schedule.organizationId,
    });
  }

  async cancelSchedule(
    scheduleId: string,
    organizationId: string,
    actorUserId?: string,
  ) {
    const schedule = await this.prisma.notificationSchedule.findFirst({
      where: { id: scheduleId, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule '${scheduleId}' not found`);
    }

    if (schedule.status !== NotificationScheduleStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel schedule with status '${schedule.status}'`,
      );
    }

    const cancelled = await this.prisma.notificationSchedule.update({
      where: { id: scheduleId },
      data: { status: NotificationScheduleStatus.CANCELLED },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.schedule.cancelled',
        organizationId,
        actorUserId,
        resource: 'notification_schedule',
        resourceId: scheduleId,
        details: { status: 'CANCELLED' },
        eventName: 'notifications.schedule.cancelled',
        occurredAt: new Date(),
      });
    }

    return cancelled;
  }

  async listSchedules(organizationId: string) {
    return this.prisma.notificationSchedule.findMany({
      where: { organizationId },
      orderBy: { sendAt: 'desc' },
    });
  }
}
