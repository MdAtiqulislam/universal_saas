import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateTaxDto } from './dto/create-tax.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { Prisma, TaxRate } from '@prisma/client';

@Injectable()
export class TaxesService {
  private readonly logger = new Logger(TaxesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all tax rates for a specific organization.
   */
  async findAll(
    organizationId: string,
    filter?: { isActive?: boolean; search?: string },
  ): Promise<TaxRate[]> {
    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

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

    return this.prisma.taxRate.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Find a single tax rate by ID within an organization.
   */
  async findOne(organizationId: string, id: string): Promise<TaxRate> {
    const taxRate = await this.prisma.taxRate.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!taxRate) {
      throw new NotFoundException(
        `Tax rate with ID ${id} not found in organization`,
      );
    }

    return taxRate;
  }

  /**
   * Create a new tax rate within an organization.
   */
  async create(
    organizationId: string,
    dto: CreateTaxDto,
    actorUserId?: string,
  ): Promise<TaxRate> {
    const normalizedCode = dto.code.trim().toUpperCase();

    if (dto.rate < 0) {
      throw new BadRequestException('Tax rate cannot be negative');
    }

    const existing = await this.prisma.taxRate.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Tax code '${normalizedCode}' already exists in this organization`,
      );
    }

    const taxRate = await this.prisma.taxRate.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        code: normalizedCode,
        rate: new Prisma.Decimal(dto.rate),
        isInclusive: dto.isInclusive ?? false,
        isActive: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'TAX_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'tax.create',
      resource: 'tax',
      resourceId: taxRate.id,
      details: {
        code: taxRate.code,
        name: taxRate.name,
        rate: taxRate.rate.toString(),
      },
    });

    return taxRate;
  }

  /**
   * Update tax rate within an organization.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateTaxDto,
    actorUserId?: string,
  ): Promise<TaxRate> {
    const existing = await this.prisma.taxRate.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Tax rate with ID ${id} not found in organization`,
      );
    }

    if (dto.rate !== undefined && dto.rate < 0) {
      throw new BadRequestException('Tax rate cannot be negative');
    }

    const updated = await this.prisma.taxRate.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : undefined,
        isInclusive: dto.isInclusive,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'TAX_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'tax.update',
      resource: 'tax',
      resourceId: updated.id,
      details: {
        code: updated.code,
        rate: updated.rate.toString(),
      },
    });

    return updated;
  }

  /**
   * Soft-delete/archive a tax rate.
   */
  async archive(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.taxRate.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Tax rate with ID ${id} not found in organization`,
      );
    }

    await this.prisma.taxRate.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'TAX_ARCHIVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'tax.archive',
      resource: 'tax',
      resourceId: existing.id,
      details: {
        code: existing.code,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Tax rate '${existing.name}' (${existing.code}) archived successfully`,
    };
  }
}
