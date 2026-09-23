import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { JobService } from '../../common/jobs/job.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto/create-schedule.dto';

@Injectable()
export class WorkflowSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobService: JobService,
    private readonly idempotency: IdempotencyService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async createSchedule(
    organizationId: string,
    workflowDefinitionId: string,
    dto: CreateScheduleDto,
    actorUserId?: string,
  ) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id: workflowDefinitionId, organizationId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException(
        `Workflow definition not found: ${workflowDefinitionId}`,
      );
    }

    if (dto.scheduleType === 'CRON' && !dto.cronExpression) {
      throw new BadRequestException(
        'Cron schedule requires a valid cronExpression',
      );
    }
    if (dto.scheduleType === 'INTERVAL' && !dto.intervalSeconds) {
      throw new BadRequestException(
        'Interval schedule requires intervalSeconds',
      );
    }

    const nextRunAt = this.calculateNextRun(
      dto.scheduleType,
      dto.cronExpression,
      dto.intervalSeconds,
    );

    const schedule = await this.prisma.workflowSchedule.create({
      data: {
        organizationId,
        workflowDefinitionId,
        scheduleType: dto.scheduleType,
        cronExpression: dto.cronExpression,
        intervalSeconds: dto.intervalSeconds,
        timezone: dto.timezone || 'UTC',
        status: 'ACTIVE',
        nextRunAt,
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_SCHEDULE_CREATED',
      organizationId,
      actorUserId,
      resource: 'workflow_schedule',
      resourceId: schedule.id,
      details: { scheduleType: dto.scheduleType, nextRunAt },
      eventName: 'workflow.schedule.created',
      occurredAt: new Date(),
    });

    return schedule;
  }

  async listSchedules(organizationId: string, workflowDefinitionId?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (workflowDefinitionId) where.workflowDefinitionId = workflowDefinitionId;

    return this.prisma.workflowSchedule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        workflowDefinition: {
          select: {
            id: true,
            key: true,
            name: true,
            status: true,
            currentVersionId: true,
          },
        },
      },
    });
  }

  async updateSchedule(
    organizationId: string,
    id: string,
    dto: UpdateScheduleDto,
    actorUserId?: string,
  ) {
    const schedule = await this.prisma.workflowSchedule.findFirst({
      where: { id, organizationId },
    });
    if (!schedule) {
      throw new NotFoundException(`Workflow schedule not found: ${id}`);
    }

    const nextRunAt =
      dto.scheduleType || dto.cronExpression || dto.intervalSeconds
        ? this.calculateNextRun(
            dto.scheduleType || schedule.scheduleType,
            dto.cronExpression || schedule.cronExpression || undefined,
            dto.intervalSeconds || schedule.intervalSeconds || undefined,
          )
        : schedule.nextRunAt;

    const updated = await this.prisma.workflowSchedule.update({
      where: { id },
      data: {
        scheduleType: dto.scheduleType,
        cronExpression: dto.cronExpression,
        intervalSeconds: dto.intervalSeconds,
        timezone: dto.timezone,
        status: dto.status,
        nextRunAt,
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_SCHEDULE_UPDATED',
      organizationId,
      actorUserId,
      resource: 'workflow_schedule',
      resourceId: id,
      details: { changes: dto },
      eventName: 'workflow.schedule.updated',
      occurredAt: new Date(),
    });

    return updated;
  }

  async runScheduleNow(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ) {
    const schedule = await this.prisma.workflowSchedule.findFirst({
      where: { id, organizationId },
      include: {
        workflowDefinition: true,
      },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule not found: ${id}`);
    }

    const currentVersionId = schedule.workflowDefinition.currentVersionId;
    if (!currentVersionId) {
      throw new BadRequestException(
        'Workflow has no published active version to execute',
      );
    }

    const occurrence = new Date().toISOString();
    // INV-399: Unique idempotency key
    const idempotencyKey = `wf-sched:${organizationId}:${schedule.id}:${occurrence}`;

    await this.jobService.createJob(organizationId, {
      jobType: 'WORKFLOW_EXECUTION',
      priority: 2,
      payload: {
        organizationId,
        workflowDefinitionId: schedule.workflowDefinitionId,
        workflowVersionId: currentVersionId,
        triggerType: 'SCHEDULE',
        idempotencyKey,
        inputContext: {
          scheduleId: schedule.id,
          manualTrigger: true,
          triggeredBy: actorUserId,
        },
      },
    });

    return { queued: true, scheduleId: schedule.id, idempotencyKey };
  }

  private calculateNextRun(
    type: string,
    _cron?: string,
    intervalSeconds?: number,
  ): Date {
    const now = Date.now();
    if (type === 'INTERVAL' && intervalSeconds) {
      return new Date(now + intervalSeconds * 1000);
    }
    // Default 1 hour next run for cron or fallback
    return new Date(now + 3600 * 1000);
  }
}
