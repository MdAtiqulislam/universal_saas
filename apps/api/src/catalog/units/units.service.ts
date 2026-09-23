import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitOfMeasure } from '@prisma/client';

@Injectable()
export class UnitsService {
  private readonly logger = new Logger(UnitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all units of measure for an organization.
   */
  async findAll(
    organizationId: string,
    filter?: { isActive?: boolean; search?: string },
  ): Promise<UnitOfMeasure[]> {
    const where: Record<string, unknown> = { organizationId };

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.search) {
      const searchTerm = filter.search.trim();
      where.OR = [
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.unitOfMeasure.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Find single unit by ID within an organization.
   */
  async findOne(organizationId: string, id: string): Promise<UnitOfMeasure> {
    const unit = await this.prisma.unitOfMeasure.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!unit) {
      throw new NotFoundException(
        `Unit of measure with ID ${id} not found in organization`,
      );
    }

    return unit;
  }

  /**
   * Create a new unit of measure for an organization.
   */
  async create(
    organizationId: string,
    dto: CreateUnitDto,
    actorUserId?: string,
  ): Promise<UnitOfMeasure> {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.unitOfMeasure.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Unit of measure code '${normalizedCode}' already exists in this organization`,
      );
    }

    const unit = await this.prisma.unitOfMeasure.create({
      data: {
        organizationId,
        code: normalizedCode,
        name: dto.name.trim(),
        symbol: dto.symbol?.trim() ?? null,
        decimalPlaces: dto.decimalPlaces ?? 2,
        isActive: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'UNIT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'unit.create',
      resource: 'unit_of_measure',
      resourceId: unit.id,
      details: {
        code: unit.code,
        name: unit.name,
      },
    });

    return unit;
  }

  /**
   * Update a unit of measure.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateUnitDto,
    actorUserId?: string,
  ): Promise<UnitOfMeasure> {
    const existing = await this.prisma.unitOfMeasure.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Unit of measure with ID ${id} not found in organization`,
      );
    }

    const updated = await this.prisma.unitOfMeasure.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        symbol:
          dto.symbol !== undefined
            ? dto.symbol
              ? dto.symbol.trim()
              : null
            : undefined,
        decimalPlaces: dto.decimalPlaces,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'UNIT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'unit.update',
      resource: 'unit_of_measure',
      resourceId: updated.id,
      details: {
        code: updated.code,
        name: updated.name,
      },
    });

    return updated;
  }

  /**
   * Deactivate a unit of measure (safe alternative to deletion).
   */
  async deactivate(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.unitOfMeasure.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Unit of measure with ID ${id} not found in organization`,
      );
    }

    await this.prisma.unitOfMeasure.update({
      where: { id },
      data: { isActive: false },
    });

    await this.eventBus.publish({
      eventName: 'UNIT_DEACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'unit.deactivate',
      resource: 'unit_of_measure',
      resourceId: existing.id,
      details: {
        code: existing.code,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Unit of measure '${existing.name}' (${existing.code}) deactivated successfully`,
    };
  }
}
