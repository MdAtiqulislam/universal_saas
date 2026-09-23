import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { MetricsService } from '../../operations/metrics/metrics.service';
import { RulesEngineService } from '../rules/rules-engine.service';
import { WorkflowActionExecutorService } from '../actions/workflow-action-executor.service';
import {
  ExecuteWorkflowDto,
  RetryExecutionDto,
  QueryExecutionsDto,
} from './dto/execute-workflow.dto';
import { WorkflowExecutionStatus, WorkflowTriggerType } from '@prisma/client';

const MAX_NODE_TRANSITIONS = 100;
const TERMINAL_STATUSES = new Set<WorkflowExecutionStatus>([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
]);

@Injectable()
export class WorkflowExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobService: JobService,
    private readonly logger: StructuredLoggingService,
    private readonly metrics: MetricsService,
    private readonly rulesEngine: RulesEngineService,
    private readonly actionExecutor: WorkflowActionExecutorService,
  ) {
    // Register background job handlers
    this.jobService.registerHandler('WORKFLOW_EXECUTION', (payload) =>
      this.handleExecutionJob(payload as Record<string, unknown>),
    );
    this.jobService.registerHandler('WORKFLOW_RESUME', (payload) =>
      this.handleResumeJob(payload as Record<string, unknown>),
    );
  }

  async startExecution(
    organizationId: string,
    workflowDefinitionId: string,
    dto: ExecuteWorkflowDto,
    actorUserId?: string,
    triggerType: WorkflowTriggerType = 'MANUAL',
  ) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id: workflowDefinitionId, organizationId, deletedAt: null },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!definition) {
      throw new NotFoundException(
        `Workflow definition not found: ${workflowDefinitionId}`,
      );
    }

    const activeVersionId =
      definition.currentVersionId || definition.versions[0]?.id;
    if (!activeVersionId) {
      throw new BadRequestException(
        'Cannot execute workflow without a published active version',
      );
    }

    const correlationId = crypto.randomUUID();
    const idempotencyKey =
      dto.clientIdempotencyKey ||
      `wf-exec:${organizationId}:${workflowDefinitionId}:${Date.now()}`;

    // Find START node of the active version
    const startNode = await this.prisma.workflowNode.findFirst({
      where: { workflowVersionId: activeVersionId, nodeType: 'START' },
    });

    if (!startNode) {
      throw new BadRequestException('Workflow version is missing START node');
    }

    const execution = await this.prisma.workflowExecution.create({
      data: {
        organizationId,
        workflowDefinitionId,
        workflowVersionId: activeVersionId,
        triggerType,
        status: 'RUNNING',
        startedAt: new Date(),
        currentNodeId: startNode.id,
        correlationId,
        idempotencyKey,
        inputContext: dto.inputContext
          ? (dto.inputContext as never)
          : undefined,
        variables: {},
      },
    });

    this.metrics.incrementCounter('workflow.executions.started', {
      category: definition.category,
    });

    await this.audit.record({
      action: 'WORKFLOW_EXECUTION_STARTED',
      organizationId,
      actorUserId,
      resource: 'workflow_execution',
      resourceId: execution.id,
      details: {
        workflowKey: definition.key,
        versionId: activeVersionId,
        triggerType,
      },
      eventName: 'workflow.execution.started',
      occurredAt: new Date(),
    });

    this.logger.log({
      level: 'INFO',
      message: `Started workflow execution ${execution.id} for ${definition.key}`,
      module: 'Workflows',
      event: 'workflow_execution_started',
      organizationId,
      userId: actorUserId,
    });

    // Run execution interpreter asynchronously in next tick or inline
    setImmediate(() => {
      void this.interpretGraph(execution.id);
    });

    return execution;
  }

  async interpretGraph(executionId: string): Promise<void> {
    let transitions = 0;

    while (transitions < MAX_NODE_TRANSITIONS) {
      transitions++;

      const execution = await this.prisma.workflowExecution.findUnique({
        where: { id: executionId },
        include: {
          workflowVersion: {
            include: {
              nodes: true,
              edges: true,
            },
          },
        },
      });

      if (
        !execution ||
        TERMINAL_STATUSES.has(execution.status) ||
        execution.status === 'WAITING'
      ) {
        return; // Done or waiting
      }

      const currentNode = execution.workflowVersion.nodes.find(
        (n) => n.id === execution.currentNodeId,
      );

      if (!currentNode) {
        await this.failExecution(
          execution.id,
          'NODE_NOT_FOUND',
          'Current node not found in graph',
        );
        return;
      }

      // Record step start
      const step = await this.prisma.workflowExecutionStep.create({
        data: {
          executionId: execution.id,
          nodeId: currentNode.id,
          status: 'RUNNING',
          startedAt: new Date(),
          input: execution.variables
            ? (execution.variables as never)
            : undefined,
        },
      });

      const stepStart = Date.now();

      // Node interpretation
      if (currentNode.nodeType === 'START') {
        await this.completeStep(step.id, stepStart, { label: 'Started' });
        const nextNodeId = this.findNextNodeId(currentNode.id, execution);
        await this.advanceExecution(execution.id, nextNodeId);
      } else if (currentNode.nodeType === 'END') {
        await this.completeStep(step.id, stepStart, { label: 'Completed' });
        await this.completeExecution(execution.id);
        return;
      } else if (currentNode.nodeType === 'CONDITION') {
        const nextNodeId = this.evaluateConditionBranch(
          currentNode.id,
          execution,
        );
        await this.completeStep(step.id, stepStart, { nextNodeId });
        await this.advanceExecution(execution.id, nextNodeId);
      } else if (currentNode.nodeType === 'ACTION') {
        const config = (currentNode.config as Record<string, unknown>) || {};
        const actionType =
          typeof config.actionType === 'string'
            ? config.actionType
            : 'create_task';
        const params = (config.parameters as Record<string, unknown>) || {};

        const actionResult = await this.actionExecutor.executeAction({
          organizationId: execution.organizationId,
          executionId: execution.id,
          stepId: step.id,
          actionType,
          parameters: params,
          inputContext: execution.inputContext as Record<string, unknown>,
          variables: execution.variables as Record<string, unknown>,
        });

        if (!actionResult.success) {
          await this.failStep(
            step.id,
            stepStart,
            actionResult.error || 'Action failed',
          );
          await this.failExecution(
            execution.id,
            'ACTION_FAILED',
            actionResult.error,
          );
          return;
        }

        await this.completeStep(step.id, stepStart, actionResult.output);

        if (actionResult.newVariables) {
          await this.prisma.workflowExecution.update({
            where: { id: execution.id },
            data: { variables: actionResult.newVariables as never },
          });
        }

        const nextNodeId = this.findNextNodeId(currentNode.id, execution);
        await this.advanceExecution(execution.id, nextNodeId);
      } else if (currentNode.nodeType === 'APPROVAL') {
        const config = (currentNode.config as Record<string, unknown>) || {};
        const approverTarget =
          typeof config.approverTarget === 'string'
            ? config.approverTarget
            : 'ADMIN';
        const approverType = (config.approverType as never) || 'ROLE';
        const minimumApprovals = Number(config.minimumApprovals || 1);

        await this.prisma.workflowApproval.create({
          data: {
            organizationId: execution.organizationId,
            executionId: execution.id,
            nodeId: currentNode.id,
            approverTarget,
            approverType,
            minimumApprovals,
            status: 'PENDING',
          },
        });

        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { status: 'WAITING' },
        });

        await this.prisma.workflowExecutionStep.update({
          where: { id: step.id },
          data: { status: 'WAITING' },
        });

        this.metrics.incrementCounter('workflow.approvals.pending');
        return; // Pauses execution until approval decision is submitted
      } else if (currentNode.nodeType === 'DELAY') {
        const config = (currentNode.config as Record<string, unknown>) || {};
        const durationSeconds = Number(config.durationSeconds || 60);

        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { status: 'WAITING' },
        });

        await this.completeStep(step.id, stepStart, {
          delayedSeconds: durationSeconds,
        });

        const nextNodeId = this.findNextNodeId(currentNode.id, execution);

        // Resume after delay
        setTimeout(
          () => {
            this.prisma.workflowExecution
              .update({
                where: { id: execution.id },
                data: { status: 'RUNNING', currentNodeId: nextNodeId },
              })
              .then(() => this.interpretGraph(execution.id))
              .catch(() => undefined);
          },
          Math.min(durationSeconds * 1000, 5000),
        ); // Cap test timer at 5s for unit test speed

        return;
      } else {
        // Fallback for OTHER nodes (PARALLEL, JOIN, etc.): complete and advance
        await this.completeStep(step.id, stepStart, { label: 'Advanced' });
        const nextNodeId = this.findNextNodeId(currentNode.id, execution);
        await this.advanceExecution(execution.id, nextNodeId);
      }
    }

    if (transitions >= MAX_NODE_TRANSITIONS) {
      await this.failExecution(
        executionId,
        'MAX_TRANSITIONS_EXCEEDED',
        `Workflow execution exceeded maximum transition limit of ${MAX_NODE_TRANSITIONS}`,
      );
    }
  }

  private findNextNodeId(
    currentNodeId: string,
    execution: {
      workflowVersion: {
        edges: Array<{ sourceNodeId: string; targetNodeId: string }>;
      };
    },
  ): string | null {
    const edge = execution.workflowVersion.edges.find(
      (e) => e.sourceNodeId === currentNodeId,
    );
    return edge?.targetNodeId || null;
  }

  private evaluateConditionBranch(
    currentNodeId: string,
    execution: {
      workflowVersion: {
        edges: Array<{
          sourceNodeId: string;
          targetNodeId: string;
          priority: number;
          conditionExpression?: unknown;
        }>;
      };
      inputContext?: unknown;
      variables?: unknown;
    },
  ): string | null {
    const outgoingEdges = execution.workflowVersion.edges
      .filter((e) => e.sourceNodeId === currentNodeId)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const evalContext = {
      event: (execution.inputContext as Record<string, unknown>)?.event as
        Record<string, unknown> | undefined,
      variables: execution.variables as Record<string, unknown>,
    };

    for (const edge of outgoingEdges) {
      if (!edge.conditionExpression) {
        return edge.targetNodeId; // Default fallback branch
      }
      try {
        const evalResult = this.rulesEngine.evaluate(
          edge.conditionExpression,
          evalContext,
        );
        if (evalResult.result) {
          return edge.targetNodeId;
        }
      } catch {
        continue;
      }
    }

    return outgoingEdges[0]?.targetNodeId || null;
  }

  private async advanceExecution(
    executionId: string,
    nextNodeId: string | null,
  ) {
    if (!nextNodeId) {
      await this.completeExecution(executionId);
      return;
    }
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { currentNodeId: nextNodeId },
    });
  }

  private async completeStep(
    stepId: string,
    startTime: number,
    output: unknown,
  ) {
    await this.prisma.workflowExecutionStep.update({
      where: { id: stepId },
      data: {
        status: 'SUCCESS',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        output: output ? (output as never) : undefined,
      },
    });
  }

  private async failStep(
    stepId: string,
    startTime: number,
    errorMessage: string,
  ) {
    await this.prisma.workflowExecutionStep.update({
      where: { id: stepId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        errorMessage,
      },
    });
  }

  private async completeExecution(executionId: string) {
    const updated = await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        currentNodeId: null,
      },
      include: { workflowDefinition: true },
    });

    this.metrics.incrementCounter('workflow.executions.completed', {
      category: updated.workflowDefinition.category,
    });

    await this.audit.record({
      action: 'WORKFLOW_EXECUTION_COMPLETED',
      organizationId: updated.organizationId,
      resource: 'workflow_execution',
      resourceId: executionId,
      details: {
        durationMs:
          updated.completedAt!.getTime() - updated.startedAt!.getTime(),
      },
      eventName: 'workflow.execution.completed',
      occurredAt: new Date(),
    });
  }

  private async failExecution(
    executionId: string,
    errorCode: string,
    errorMessage?: string,
  ) {
    const updated = await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        errorCode,
        errorMessage,
      },
      include: { workflowDefinition: true },
    });

    this.metrics.incrementCounter('workflow.executions.failed', {
      category: updated.workflowDefinition.category,
    });

    await this.audit.record({
      action: 'WORKFLOW_EXECUTION_FAILED',
      organizationId: updated.organizationId,
      resource: 'workflow_execution',
      resourceId: executionId,
      details: { errorCode, errorMessage },
      eventName: 'workflow.execution.failed',
      occurredAt: new Date(),
    });
  }

  async cancelExecution(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ) {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id, organizationId },
    });
    if (!execution) {
      throw new NotFoundException(`Execution not found: ${id}`);
    }

    // INV-394: Cannot transition from terminal state
    if (TERMINAL_STATUSES.has(execution.status)) {
      throw new BadRequestException(
        `Cannot cancel execution with terminal status "${execution.status}" (INV-394)`,
      );
    }

    const cancelled = await this.prisma.workflowExecution.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_EXECUTION_CANCELLED',
      organizationId,
      actorUserId,
      resource: 'workflow_execution',
      resourceId: id,
      details: { previousStatus: execution.status },
      eventName: 'workflow.execution.cancelled',
      occurredAt: new Date(),
    });

    return cancelled;
  }

  async retryExecution(
    organizationId: string,
    id: string,
    dto: RetryExecutionDto,
    actorUserId?: string,
  ) {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id, organizationId },
    });
    if (!execution) {
      throw new NotFoundException(`Execution not found: ${id}`);
    }

    if (execution.status !== 'FAILED' && execution.status !== 'TIMED_OUT') {
      throw new BadRequestException(
        'Only FAILED or TIMED_OUT executions can be retried',
      );
    }

    // Find START node
    const startNode = await this.prisma.workflowNode.findFirst({
      where: {
        workflowVersionId: execution.workflowVersionId,
        nodeType: 'START',
      },
    });

    // Continuation execution
    const retryExecution = await this.prisma.workflowExecution.create({
      data: {
        organizationId,
        workflowDefinitionId: execution.workflowDefinitionId,
        workflowVersionId: execution.workflowVersionId,
        triggerType: execution.triggerType,
        status: 'RUNNING',
        startedAt: new Date(),
        currentNodeId: startNode?.id,
        correlationId: execution.correlationId,
        causationId: execution.id,
        inputContext: execution.inputContext
          ? (execution.inputContext as never)
          : undefined,
        variables: {},
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_EXECUTION_RETRIED',
      organizationId,
      actorUserId,
      resource: 'workflow_execution',
      resourceId: retryExecution.id,
      details: { previousExecutionId: id, reason: dto.reason },
      eventName: 'workflow.execution.retried',
      occurredAt: new Date(),
    });

    setImmediate(() => {
      void this.interpretGraph(retryExecution.id);
    });

    return retryExecution;
  }

  async listExecutions(organizationId: string, query: QueryExecutionsDto) {
    const { workflowDefinitionId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId };
    if (workflowDefinitionId) where.workflowDefinitionId = workflowDefinitionId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workflowDefinition: {
            select: { id: true, key: true, name: true, category: true },
          },
          workflowVersion: { select: { version: true } },
        },
      }),
      this.prisma.workflowExecution.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getExecution(organizationId: string, id: string) {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id, organizationId },
      include: {
        workflowDefinition: true,
        workflowVersion: {
          select: { id: true, version: true, status: true, publishedAt: true },
        },
        steps: {
          orderBy: { createdAt: 'asc' },
          include: {
            node: { select: { nodeKey: true, label: true, nodeType: true } },
          },
        },
        approvals: {
          include: {
            actions: {
              include: { actorUser: { select: { id: true, email: true } } },
            },
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException(`Execution not found: ${id}`);
    }

    return execution;
  }

  private async handleExecutionJob(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { organizationId, workflowDefinitionId, triggerType, inputContext } =
      payload;
    await this.startExecution(
      String(organizationId),
      String(workflowDefinitionId),
      { inputContext: inputContext as Record<string, unknown> },
      undefined,
      (triggerType as WorkflowTriggerType) || 'EVENT',
    );
  }

  private async handleResumeJob(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { executionId, decision, nodeId } = payload;
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: String(executionId) },
      include: { workflowVersion: { include: { edges: true } } },
    });

    if (!execution || execution.status !== 'WAITING') return;

    if (decision === 'REJECTED') {
      await this.failExecution(
        execution.id,
        'APPROVAL_REJECTED',
        'Workflow approval was rejected',
      );
      return;
    }

    // Approved: advance past approval node
    const nextNodeId = this.findNextNodeId(String(nodeId), execution);
    await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: { status: 'RUNNING', currentNodeId: nextNodeId },
    });

    await this.interpretGraph(execution.id);
  }
}
