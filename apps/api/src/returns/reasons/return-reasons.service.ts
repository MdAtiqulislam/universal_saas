import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  CreateReturnReasonDto,
  UpdateReturnReasonDto,
  QueryReturnReasonDto,
} from './dto/return-reason.dto';
import { ReturnReason, Prisma } from '@prisma/client';

@Injectable()
export class ReturnReasonsService {
  private readonly logger = new Logger(ReturnReasonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(
    organizationId: string,
    query?: QueryReturnReasonDto,
  ): Promise<ReturnReason[]> {
    const where: Prisma.ReturnReasonWhereInput = { organizationId };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.returnReason.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<ReturnReason> {
    const reason = await this.prisma.returnReason.findFirst({
      where: { id, organizationId },
    });

    if (!reason) {
      throw new NotFoundException(
        `Return reason with ID ${id} not found in this organization.`,
      );
    }

    return reason;
  }

  async create(
    organizationId: string,
    dto: CreateReturnReasonDto,
    actorUserId?: string,
  ): Promise<ReturnReason> {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.returnReason.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: normalizedCode,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Return reason with code '${normalizedCode}' already exists in this organization.`,
      );
    }

    const reason = await this.prisma.returnReason.create({
      data: {
        organizationId,
        code: normalizedCode,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        requiresInspection: dto.requiresInspection ?? true,
        defaultDisposition: dto.defaultDisposition ?? 'RESTOCK',
        isActive: dto.isActive ?? true,
      },
    });

    await this.eventBus.publish({
      eventName: 'RETURN_REASON_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'returns.reasons.create',
      resource: 'return_reason',
      resourceId: reason.id,
      details: {
        code: reason.code,
        name: reason.name,
        requiresInspection: reason.requiresInspection,
      },
    });

    return reason;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateReturnReasonDto,
    actorUserId?: string,
  ): Promise<ReturnReason> {
    await this.findOne(organizationId, id);

    const updated = await this.prisma.returnReason.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description:
          dto.description !== undefined ? dto.description.trim() : undefined,
        requiresInspection: dto.requiresInspection,
        defaultDisposition: dto.defaultDisposition,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'RETURN_REASON_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'returns.reasons.update',
      resource: 'return_reason',
      resourceId: updated.id,
      details: {
        code: updated.code,
        name: updated.name,
      },
    });

    return updated;
  }
}
