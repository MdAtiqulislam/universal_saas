import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { Supplier } from '@prisma/client';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List suppliers with pagination, search, and active filtering.
   */
  async findAll(organizationId: string, query: SupplierQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const searchNormalized = query.search.trim();
      where.OR = [
        { name: { contains: searchNormalized, mode: 'insensitive' } },
        { code: { contains: searchNormalized, mode: 'insensitive' } },
        { email: { contains: searchNormalized, mode: 'insensitive' } },
      ];
    }

    const [total, suppliers] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        include: {
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          contacts: {
            where: { isPrimary: true },
            select: { id: true, name: true, email: true, phone: true },
          },
        },
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      suppliers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single supplier by ID with complete contacts and addresses.
   */
  async findOne(organizationId: string, id: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        contacts: {
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        },
        addresses: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${id} not found in organization`,
      );
    }

    return supplier;
  }

  /**
   * Create a new supplier.
   */
  async create(
    organizationId: string,
    dto: CreateSupplierDto,
    actorUserId?: string,
  ): Promise<Supplier> {
    const normalizedCode = dto.code.trim().toUpperCase();

    // 1. Check code uniqueness
    const existing = await this.prisma.supplier.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Supplier code '${normalizedCode}' already exists in this organization`,
      );
    }

    // 2. Validate Currency if specified
    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: {
          id: dto.currencyId,
          isActive: true,
        },
      });

      if (!currency) {
        throw new BadRequestException(
          `Currency '${dto.currencyId}' does not exist or is inactive`,
        );
      }
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        organizationId,
        code: normalizedCode,
        name: dto.name.trim(),
        legalName: dto.legalName?.trim() ?? null,
        taxNumber: dto.taxNumber?.trim() ?? null,
        email: dto.email?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        currencyId: dto.currencyId ?? null,
        paymentTermsDays: dto.paymentTermsDays ?? 0,
        notes: dto.notes?.trim() ?? null,
        isActive: true,
      },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier.create',
      resource: 'supplier',
      resourceId: supplier.id,
      details: {
        code: supplier.code,
        name: supplier.name,
      },
    });

    return supplier;
  }

  /**
   * Update supplier profile.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateSupplierDto,
    actorUserId?: string,
  ): Promise<Supplier> {
    const existing = await this.prisma.supplier.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Supplier with ID ${id} not found in organization`,
      );
    }

    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: {
          id: dto.currencyId,
          isActive: true,
        },
      });

      if (!currency) {
        throw new BadRequestException(
          `Currency '${dto.currencyId}' does not exist or is inactive`,
        );
      }
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        legalName:
          dto.legalName !== undefined
            ? dto.legalName
              ? dto.legalName.trim()
              : null
            : undefined,
        taxNumber:
          dto.taxNumber !== undefined
            ? dto.taxNumber
              ? dto.taxNumber.trim()
              : null
            : undefined,
        email:
          dto.email !== undefined
            ? dto.email
              ? dto.email.trim()
              : null
            : undefined,
        phone:
          dto.phone !== undefined
            ? dto.phone
              ? dto.phone.trim()
              : null
            : undefined,
        currencyId: dto.currencyId !== undefined ? dto.currencyId : undefined,
        paymentTermsDays:
          dto.paymentTermsDays !== undefined ? dto.paymentTermsDays : undefined,
        notes:
          dto.notes !== undefined
            ? dto.notes
              ? dto.notes.trim()
              : null
            : undefined,
        isActive: dto.isActive,
      },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier.update',
      resource: 'supplier',
      resourceId: updated.id,
      details: {
        code: updated.code,
        name: updated.name,
      },
    });

    return updated;
  }

  /**
   * Soft delete supplier.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.supplier.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Supplier with ID ${id} not found in organization`,
      );
    }

    await this.prisma.supplier.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier.delete',
      resource: 'supplier',
      resourceId: existing.id,
      details: {
        code: existing.code,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Supplier '${existing.name}' (${existing.code}) soft-deleted successfully`,
    };
  }
}
