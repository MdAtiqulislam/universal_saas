import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { WorkflowGraphValidatorService } from '../definitions/workflow-graph-validator.service';
import { CreateWorkflowVersionDto } from './dto/create-workflow-version.dto';

@Injectable()
export class WorkflowVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
    private readonly graphValidator: WorkflowGraphValidatorService,
  ) {}

  async createVersion(
    organizationId: string,
    workflowDefinitionId: string,
    dto: CreateWorkflowVersionDto,
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

    // Determine next version number
    const lastVersion = await this.prisma.workflowVersion.findFirst({
      where: { workflowDefinitionId },
      orderBy: { version: 'desc' },
    });

    const nextVersionNumber = (lastVersion?.version || 0) + 1;

    // Optional early validation of graph (draft can be partially valid, but nodeKey uniqueness is enforced)
    const nodeKeySet = new Set<string>();
    for (const node of dto.nodes) {
      if (nodeKeySet.has(node.nodeKey)) {
        throw new BadRequestException(
          `Duplicate nodeKey "${node.nodeKey}" in version nodes`,
        );
      }
      nodeKeySet.add(node.nodeKey);
    }

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.create({
        data: {
          workflowDefinitionId,
          version: nextVersionNumber,
          status: 'DRAFT',
        },
      });

      // Create nodes
      const nodeEntityMap = new Map<string, string>(); // nodeKey -> id
      for (const node of dto.nodes) {
        const createdNode = await tx.workflowNode.create({
          data: {
            workflowVersionId: version.id,
            nodeKey: node.nodeKey,
            nodeType: node.nodeType,
            label: node.label,
            config: node.config ? (node.config as never) : undefined,
          },
        });
        nodeEntityMap.set(node.nodeKey, createdNode.id);
      }

      // Create edges
      for (const edge of dto.edges) {
        const sourceNodeId = nodeEntityMap.get(edge.sourceNodeKey);
        const targetNodeId = nodeEntityMap.get(edge.targetNodeKey);

        if (!sourceNodeId || !targetNodeId) {
          throw new BadRequestException(
            `Edge references invalid node keys: source "${edge.sourceNodeKey}", target "${edge.targetNodeKey}"`,
          );
        }

        await tx.workflowEdge.create({
          data: {
            workflowVersionId: version.id,
            sourceNodeId,
            targetNodeId,
            conditionRuleId: edge.conditionRuleId,
            conditionExpression: edge.conditionExpression
              ? (edge.conditionExpression as never)
              : undefined,
            priority: edge.priority || 0,
          },
        });
      }

      await this.audit.record({
        action: 'WORKFLOW_VERSION_CREATED',
        organizationId,
        actorUserId,
        resource: 'workflow_version',
        resourceId: version.id,
        details: { version: nextVersionNumber, workflowKey: definition.key },
        eventName: 'workflow.version.created',
        occurredAt: new Date(),
      });

      return version;
    });
  }

  async listVersions(organizationId: string, workflowDefinitionId: string) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id: workflowDefinitionId, organizationId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException(
        `Workflow definition not found: ${workflowDefinitionId}`,
      );
    }

    return this.prisma.workflowVersion.findMany({
      where: { workflowDefinitionId },
      orderBy: { version: 'desc' },
      include: {
        _count: {
          select: { nodes: true, edges: true, executions: true },
        },
      },
    });
  }

  async getVersion(
    organizationId: string,
    workflowDefinitionId: string,
    versionId: string,
  ) {
    const version = await this.prisma.workflowVersion.findFirst({
      where: {
        id: versionId,
        workflowDefinitionId,
        workflowDefinition: { organizationId, deletedAt: null },
      },
      include: {
        nodes: {
          include: {
            rules: true,
            actions: true,
          },
        },
        edges: {
          include: {
            sourceNode: {
              select: { nodeKey: true, label: true, nodeType: true },
            },
            targetNode: {
              select: { nodeKey: true, label: true, nodeType: true },
            },
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(`Workflow version not found: ${versionId}`);
    }

    return version;
  }

  async validateVersion(
    organizationId: string,
    workflowDefinitionId: string,
    versionId: string,
  ) {
    const version = await this.getVersion(
      organizationId,
      workflowDefinitionId,
      versionId,
    );

    const nodesInput = version.nodes.map((n) => ({
      id: n.id,
      nodeKey: n.nodeKey,
      nodeType: n.nodeType,
      label: n.label,
      config: n.config as Record<string, unknown> | null,
    }));

    const edgesInput = version.edges.map((e) => ({
      id: e.id,
      sourceNodeKey: e.sourceNode.nodeKey,
      targetNodeKey: e.targetNode.nodeKey,
      conditionRuleId: e.conditionRuleId,
      conditionExpression: e.conditionExpression as Record<
        string,
        unknown
      > | null,
      priority: e.priority,
    }));

    const validation = this.graphValidator.validateGraph(
      nodesInput,
      edgesInput,
    );

    return {
      versionId,
      version: version.version,
      status: version.status,
      ...validation,
    };
  }

  async publishVersion(
    organizationId: string,
    workflowDefinitionId: string,
    versionId: string,
    actorUserId?: string,
  ) {
    const version = await this.getVersion(
      organizationId,
      workflowDefinitionId,
      versionId,
    );

    // INV-380: Check if already published
    if (version.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Workflow version is already published and immutable (INV-380)',
      );
    }
    if (version.status === 'RETIRED') {
      throw new BadRequestException(
        'Cannot publish a retired workflow version',
      );
    }

    // Graph validation
    const nodesInput = version.nodes.map((n) => ({
      id: n.id,
      nodeKey: n.nodeKey,
      nodeType: n.nodeType,
      label: n.label,
      config: n.config as Record<string, unknown> | null,
    }));

    const edgesInput = version.edges.map((e) => ({
      id: e.id,
      sourceNodeKey: e.sourceNode.nodeKey,
      targetNodeKey: e.targetNode.nodeKey,
      conditionRuleId: e.conditionRuleId,
      conditionExpression: e.conditionExpression as Record<
        string,
        unknown
      > | null,
      priority: e.priority,
    }));

    this.graphValidator.assertValidGraph(nodesInput, edgesInput);

    // Compute deterministic checksum and snapshot
    const snapshot = {
      version: version.version,
      nodes: version.nodes,
      edges: version.edges,
      publishedAt: new Date().toISOString(),
    };
    const snapshotStr = JSON.stringify(snapshot);
    const checksum = crypto
      .createHash('sha256')
      .update(snapshotStr)
      .digest('hex');

    return this.prisma.$transaction(async (tx) => {
      // Retire previously active versions for this workflow definition
      await tx.workflowVersion.updateMany({
        where: {
          workflowDefinitionId,
          status: 'PUBLISHED',
        },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
        },
      });

      // Update version to PUBLISHED
      const published = await tx.workflowVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedByUserId: actorUserId,
          checksum,
          definitionSnapshot: snapshot as never,
        },
      });

      // INV-381: Set current active version on definition
      await tx.workflowDefinition.update({
        where: { id: workflowDefinitionId },
        data: {
          status: 'ACTIVE',
          currentVersionId: versionId,
        },
      });

      await this.audit.record({
        action: 'WORKFLOW_PUBLISHED',
        organizationId,
        actorUserId,
        resource: 'workflow_version',
        resourceId: versionId,
        details: { version: version.version, checksum },
        eventName: 'workflow.published',
        occurredAt: new Date(),
      });

      this.logger.log({
        level: 'INFO',
        message: `Published workflow version ${version.version} with checksum ${checksum}`,
        module: 'Workflows',
        event: 'workflow_published',
        organizationId,
        userId: actorUserId,
      });

      return published;
    });
  }

  async retireVersion(
    organizationId: string,
    workflowDefinitionId: string,
    versionId: string,
    actorUserId?: string,
  ) {
    const version = await this.getVersion(
      organizationId,
      workflowDefinitionId,
      versionId,
    );

    const retired = await this.prisma.workflowVersion.update({
      where: { id: versionId },
      data: {
        status: 'RETIRED',
        retiredAt: new Date(),
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_RETIRED',
      organizationId,
      actorUserId,
      resource: 'workflow_version',
      resourceId: versionId,
      details: { version: version.version },
      eventName: 'workflow.retired',
      occurredAt: new Date(),
    });

    return retired;
  }
}
