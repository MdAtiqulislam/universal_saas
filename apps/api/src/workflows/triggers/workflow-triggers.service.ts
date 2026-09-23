import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { RulesEngineService } from '../rules/rules-engine.service';
import { TriggerCatalogService } from './trigger-catalog.service';
import { WorkflowTriggerType } from '@prisma/client';

export interface CreateTriggerDto {
  triggerType: WorkflowTriggerType;
  eventType?: string;
  filterExpression?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

@Injectable()
export class WorkflowTriggersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService,
    private readonly logger: StructuredLoggingService,
    private readonly rulesEngine: RulesEngineService,
    private readonly triggerCatalog: TriggerCatalogService,
  ) {}

  async createTrigger(
    organizationId: string,
    workflowDefinitionId: string,
    dto: CreateTriggerDto,
  ) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id: workflowDefinitionId, organizationId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException(
        `Workflow definition not found: ${workflowDefinitionId}`,
      );
    }

    if (dto.triggerType === 'EVENT') {
      if (!dto.eventType) {
        throw new BadRequestException('Event trigger requires an eventType');
      }
      this.triggerCatalog.assertSupportedEvent(dto.eventType);
    }

    return this.prisma.workflowTrigger.create({
      data: {
        organizationId,
        workflowDefinitionId,
        triggerType: dto.triggerType,
        eventType: dto.eventType,
        filterExpression: dto.filterExpression
          ? (dto.filterExpression as never)
          : undefined,
        config: dto.config ? (dto.config as never) : undefined,
        status: 'ACTIVE',
      },
    });
  }

  async listTriggers(organizationId: string, workflowDefinitionId?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (workflowDefinitionId) where.workflowDefinitionId = workflowDefinitionId;

    return this.prisma.workflowTrigger.findMany({
      where,
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

  async deleteTrigger(organizationId: string, triggerId: string) {
    const trigger = await this.prisma.workflowTrigger.findFirst({
      where: { id: triggerId, organizationId },
    });
    if (!trigger) {
      throw new NotFoundException(`Trigger not found: ${triggerId}`);
    }

    await this.prisma.workflowTrigger.delete({
      where: { id: triggerId },
    });

    return { success: true };
  }

  async processEvent(
    organizationId: string,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    // Find all active triggers for this organization and eventType
    const triggers = await this.prisma.workflowTrigger.findMany({
      where: {
        organizationId,
        triggerType: 'EVENT',
        eventType,
        status: 'ACTIVE',
        workflowDefinition: {
          status: 'ACTIVE',
          currentVersionId: { not: null },
          deletedAt: null,
        },
      },
      include: {
        workflowDefinition: {
          select: { id: true, key: true, currentVersionId: true },
        },
      },
    });

    for (const trigger of triggers) {
      const currentVersionId = trigger.workflowDefinition.currentVersionId;
      if (!currentVersionId) continue;

      // Evaluate filter expression if present
      if (trigger.filterExpression) {
        try {
          const evalContext = {
            event: {
              id: eventId,
              type: eventType,
              payload,
            },
          };
          const evalResult = this.rulesEngine.evaluate(
            trigger.filterExpression,
            evalContext,
          );
          if (!evalResult.result) {
            continue; // Filter did not match
          }
        } catch (err: unknown) {
          const errMsg =
            err instanceof Error ? err.message : 'Unknown filter error';
          this.logger.log({
            level: 'WARN',
            message: `Event filter evaluation failed for trigger ${trigger.id}: ${errMsg}`,
            module: 'Workflows',
            event: 'trigger_filter_failed',
            organizationId,
          });
          continue;
        }
      }

      // Idempotency key for event trigger: organizationId + eventId + workflowVersionId (INV-396)
      const idempotencyKey = `wf-event:${organizationId}:${eventId}:${currentVersionId}`;

      // Enqueue workflow execution job via M36 JobService
      await this.jobService.createJob(organizationId, {
        jobType: 'WORKFLOW_EXECUTION',
        priority: 1,
        payload: {
          organizationId,
          workflowDefinitionId: trigger.workflowDefinitionId,
          workflowVersionId: currentVersionId,
          triggerType: 'EVENT',
          triggerEventId: eventId,
          idempotencyKey,
          inputContext: {
            event: {
              eventId,
              eventType,
              payload,
            },
          },
        },
      });
    }
  }
}
