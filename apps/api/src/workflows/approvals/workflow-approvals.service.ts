import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { JobService } from '../../common/jobs/job.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import {
  ApprovalDecisionDto,
  DelegateApprovalDto,
  QueryApprovalsDto,
} from './dto/approval-action.dto';
import { WorkflowApprovalStatus } from '@prisma/client';

@Injectable()
export class WorkflowApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobService: JobService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async listApprovals(organizationId: string, query: QueryApprovalsDto) {
    const where: Record<string, unknown> = { organizationId };
    if (query.status) where.status = query.status;

    return this.prisma.workflowApproval.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        execution: {
          select: {
            id: true,
            status: true,
            workflowDefinition: { select: { id: true, name: true, key: true } },
            workflowVersion: { select: { version: true } },
          },
        },
        node: { select: { nodeKey: true, label: true } },
        actions: {
          include: {
            actorUser: { select: { id: true, email: true } },
            delegatedFromUser: { select: { id: true, email: true } },
          },
        },
      },
    });
  }

  async getApproval(organizationId: string, id: string) {
    const approval = await this.prisma.workflowApproval.findFirst({
      where: { id, organizationId },
      include: {
        execution: {
          select: {
            id: true,
            status: true,
            workflowDefinition: { select: { id: true, name: true, key: true } },
            workflowVersion: { select: { version: true } },
          },
        },
        node: { select: { nodeKey: true, label: true } },
        actions: {
          include: {
            actorUser: { select: { id: true, email: true } },
            delegatedFromUser: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException(`Workflow approval not found: ${id}`);
    }

    return approval;
  }

  async recordDecision(
    organizationId: string,
    id: string,
    dto: ApprovalDecisionDto,
    actorUserId: string,
  ) {
    const approval = await this.getApproval(organizationId, id);

    if (approval.status !== 'PENDING' && approval.status !== 'ESCALATED') {
      throw new BadRequestException(
        `Approval is already resolved with status ${approval.status}. Cannot record new decision.`,
      );
    }

    if (approval.expiresAt && approval.expiresAt < new Date()) {
      await this.prisma.workflowApproval.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Approval request has expired');
    }

    // INV-397: Check if actor already voted
    const existingVote = approval.actions.find(
      (a) => a.actorUserId === actorUserId,
    );
    if (existingVote) {
      throw new ConflictException(
        'An approval decision has already been recorded by this user (INV-397)',
      );
    }

    // INV-398: Verify approver eligibility
    await this.verifyEligibility(
      organizationId,
      approval,
      actorUserId,
      dto.delegatedFromUserId,
    );

    return this.prisma.$transaction(async (tx) => {
      // Record individual decision
      await tx.workflowApprovalAction.create({
        data: {
          approvalId: id,
          actorUserId,
          decision: dto.decision,
          reason: dto.reason,
          delegatedFromUserId: dto.delegatedFromUserId,
        },
      });

      let nextStatus: WorkflowApprovalStatus = approval.status;

      if (dto.decision === 'REJECTED') {
        nextStatus = 'REJECTED';
      } else if (dto.decision === 'APPROVED') {
        const approvedCount =
          approval.actions.filter((a) => a.decision === 'APPROVED').length + 1;

        if (approval.approvalType === 'ANY_ONE') {
          nextStatus = 'APPROVED';
        } else if (approval.approvalType === 'MINIMUM_COUNT') {
          if (approvedCount >= approval.minimumApprovals) {
            nextStatus = 'APPROVED';
          }
        } else if (approval.approvalType === 'ALL') {
          // If minimumApprovals specified or count met
          if (approvedCount >= approval.minimumApprovals) {
            nextStatus = 'APPROVED';
          }
        } else {
          nextStatus = 'APPROVED';
        }
      }

      const updated = await tx.workflowApproval.update({
        where: { id },
        data: {
          status: nextStatus,
          resolvedAt: nextStatus !== 'PENDING' ? new Date() : undefined,
        },
      });

      // Emit audit
      await this.audit.record({
        action:
          dto.decision === 'APPROVED'
            ? 'WORKFLOW_APPROVED'
            : 'WORKFLOW_REJECTED',
        organizationId,
        actorUserId,
        resource: 'workflow_approval',
        resourceId: id,
        details: {
          decision: dto.decision,
          reason: dto.reason,
          finalStatus: nextStatus,
        },
        eventName: `workflow.approval.${dto.decision.toLowerCase()}`,
        occurredAt: new Date(),
      });

      // If approval is resolved, queue resumption of execution
      if (nextStatus === 'APPROVED' || nextStatus === 'REJECTED') {
        await this.jobService.createJob(organizationId, {
          jobType: 'WORKFLOW_RESUME',
          priority: 2,
          payload: {
            organizationId,
            executionId: approval.executionId,
            approvalId: id,
            nodeId: approval.nodeId,
            decision: nextStatus,
          },
        });
      }

      return updated;
    });
  }

  async delegateApproval(
    organizationId: string,
    id: string,
    dto: DelegateApprovalDto,
    actorUserId: string,
  ) {
    const approval = await this.getApproval(organizationId, id);

    if (approval.status !== 'PENDING') {
      throw new BadRequestException('Can only delegate a pending approval');
    }

    // Verify actor was eligible before delegating
    await this.verifyEligibility(organizationId, approval, actorUserId);

    await this.audit.record({
      action: 'WORKFLOW_DELEGATED',
      organizationId,
      actorUserId,
      resource: 'workflow_approval',
      resourceId: id,
      details: { delegateUserId: dto.delegateUserId, reason: dto.reason },
      eventName: 'workflow.approval.delegated',
      occurredAt: new Date(),
    });

    return {
      delegated: true,
      approvalId: id,
      delegateUserId: dto.delegateUserId,
    };
  }

  async checkEscalations() {
    const now = new Date();
    const overdue = await this.prisma.workflowApproval.findMany({
      where: {
        status: 'PENDING',
        escalateAt: { lte: now },
      },
    });

    for (const app of overdue) {
      await this.prisma.workflowApproval.update({
        where: { id: app.id },
        data: { status: 'ESCALATED' },
      });

      await this.audit.record({
        action: 'WORKFLOW_ESCALATED',
        organizationId: app.organizationId,
        resource: 'workflow_approval',
        resourceId: app.id,
        details: { escalatedTo: app.escalatedTo },
        eventName: 'workflow.approval.escalated',
        occurredAt: new Date(),
      });
    }

    return { escalatedCount: overdue.length };
  }

  private async verifyEligibility(
    organizationId: string,
    approval: {
      approverType: string;
      approverTarget: string;
    },
    userId: string,
    delegatedFromUserId?: string,
  ): Promise<void> {
    const effectiveUserId = delegatedFromUserId || userId;

    if (approval.approverType === 'USER') {
      if (approval.approverTarget !== effectiveUserId) {
        throw new ForbiddenException(
          'User is not an eligible approver for this approval request (INV-398)',
        );
      }
      return;
    }

    if (approval.approverType === 'ROLE') {
      // Check user roles in organization
      const memberRole = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: effectiveUserId,
          status: 'ACTIVE',
          memberRoles: {
            some: {
              role: {
                name: approval.approverTarget,
              },
            },
          },
        },
      });

      if (!memberRole) {
        throw new ForbiddenException(
          `User does not possess the required role "${approval.approverTarget}" to approve this request (INV-398)`,
        );
      }
      return;
    }

    if (approval.approverType === 'OWNER') {
      const isOwner = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: effectiveUserId,
          status: 'ACTIVE',
          memberRoles: {
            some: {
              role: {
                name: 'OWNER',
              },
            },
          },
        },
      });

      if (!isOwner) {
        throw new ForbiddenException(
          'Only organization OWNER can approve this request (INV-398)',
        );
      }
    }
  }
}
