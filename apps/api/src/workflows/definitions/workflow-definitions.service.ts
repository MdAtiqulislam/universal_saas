import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
  QueryWorkflowDefinitionDto,
} from './dto/create-workflow-definition.dto';

@Injectable()
export class WorkflowDefinitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async createDefinition(
    organizationId: string,
    dto: CreateWorkflowDefinitionDto,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.workflowDefinition.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key: dto.key,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new ConflictException(
        `Workflow definition with key "${dto.key}" already exists for this organization (INV-376)`,
      );
    }

    const definition = await this.prisma.workflowDefinition.create({
      data: {
        organizationId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        category: dto.category || 'GENERAL',
        status: 'DRAFT',
        createdByUserId: actorUserId,
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_CREATED',
      organizationId,
      actorUserId,
      resource: 'workflow_definition',
      resourceId: definition.id,
      details: { key: definition.key, name: definition.name },
      eventName: 'workflow.created',
      occurredAt: new Date(),
    });

    this.logger.log({
      level: 'INFO',
      message: `Created workflow definition ${definition.key}`,
      module: 'Workflows',
      event: 'workflow_created',
      organizationId,
      userId: actorUserId,
    });

    return definition;
  }

  async listDefinitions(
    organizationId: string,
    query: QueryWorkflowDefinitionDto,
  ) {
    const { status, category, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (status) where.status = status;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.workflowDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          versions: {
            select: {
              id: true,
              version: true,
              status: true,
              publishedAt: true,
            },
            orderBy: { version: 'desc' },
            take: 5,
          },
        },
      }),
      this.prisma.workflowDefinition.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDefinition(organizationId: string, id: string) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
        triggers: true,
        schedules: true,
      },
    });

    if (!definition) {
      throw new NotFoundException(`Workflow definition not found: ${id}`);
    }

    return definition;
  }

  async updateDefinition(
    organizationId: string,
    id: string,
    dto: UpdateWorkflowDefinitionDto,
    actorUserId?: string,
  ) {
    const definition = await this.getDefinition(organizationId, id);

    const updated = await this.prisma.workflowDefinition.update({
      where: { id: definition.id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        status: dto.status,
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_UPDATED',
      organizationId,
      actorUserId,
      resource: 'workflow_definition',
      resourceId: id,
      details: { changes: dto },
      eventName: 'workflow.updated',
      occurredAt: new Date(),
    });

    return updated;
  }

  async deleteDefinition(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ) {
    const definition = await this.getDefinition(organizationId, id);

    await this.prisma.workflowDefinition.update({
      where: { id: definition.id },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
      },
    });

    await this.audit.record({
      action: 'WORKFLOW_DELETED',
      organizationId,
      actorUserId,
      resource: 'workflow_definition',
      resourceId: id,
      details: { key: definition.key },
      eventName: 'workflow.deleted',
      occurredAt: new Date(),
    });

    return { success: true };
  }
}
