import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { IntegrationConnectionStatus } from '@prisma/client';

@Injectable()
export class IntegrationConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async listConnections(organizationId: string) {
    return this.prisma.integrationConnection.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            providerKey: true,
            category: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnection(organizationId: string, id: string) {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { provider: true },
    });
    if (!connection)
      throw new NotFoundException(`Integration connection '${id}' not found`);
    return connection;
  }

  async createConnection(
    organizationId: string,
    dto: CreateConnectionDto,
    actorUserId: string,
  ) {
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { id: dto.providerId },
    });
    if (!provider)
      throw new BadRequestException(`Provider '${dto.providerId}' not found`);

    const existing = await this.prisma.integrationConnection.findUnique({
      where: { organizationId_name: { organizationId, name: dto.name } },
    });
    if (existing)
      throw new ConflictException(
        `Connection named '${dto.name}' already exists`,
      );

    const connection = await this.prisma.integrationConnection.create({
      data: {
        organizationId,
        providerId: dto.providerId,
        name: dto.name,
        description: dto.description,
        configData: (dto.configData ?? {}) as never,
        status: 'PENDING',
      },
    });

    await this.audit.record({
      eventName: 'INTEGRATION_CONNECTION_CREATED',
      action: 'INTEGRATION_CONNECTION_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'integration_connection',
      resourceId: connection.id,
      details: { providerId: dto.providerId, name: dto.name },
    });

    this.logger.log({
      level: 'INFO',
      message: 'Integration connection created',
      module: 'Integrations',
      event: 'INTEGRATION_CONNECTION_CREATED',
      organizationId,
      connectionId: connection.id,
    });

    return connection;
  }

  async updateConnection(
    organizationId: string,
    id: string,
    dto: UpdateConnectionDto,
    actorUserId: string,
  ) {
    await this.getConnection(organizationId, id);

    const updated = await this.prisma.integrationConnection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && {
          status: dto.status as IntegrationConnectionStatus,
        }),
        ...(dto.configData !== undefined && {
          configData: dto.configData as never,
        }),
      },
    });

    await this.audit.record({
      eventName: 'INTEGRATION_CONNECTION_UPDATED',
      action: 'INTEGRATION_CONNECTION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'integration_connection',
      resourceId: id,
      details: dto as Record<string, unknown>,
    });

    return updated;
  }

  async deleteConnection(
    organizationId: string,
    id: string,
    actorUserId: string,
  ) {
    await this.getConnection(organizationId, id);

    await this.prisma.integrationConnection.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      eventName: 'INTEGRATION_CONNECTION_DELETED',
      action: 'INTEGRATION_CONNECTION_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'integration_connection',
      resourceId: id,
    });

    this.logger.log({
      level: 'INFO',
      message: 'Integration connection deleted',
      module: 'Integrations',
      event: 'INTEGRATION_CONNECTION_DELETED',
      organizationId,
      connectionId: id,
    });

    return { success: true };
  }
}
