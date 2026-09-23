import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateWarehouseZoneDto } from './dto/create-zone.dto';
import { UpdateWarehouseZoneDto } from './dto/update-zone.dto';
import { WarehouseZoneQueryDto } from './dto/zone-query.dto';
import { WarehouseZone, Prisma } from '@prisma/client';

export type WarehouseZoneWithLocation = WarehouseZone & {
  location: { id: string; code: string; name: string };
};

@Injectable()
export class WarehouseZonesService {
  private readonly logger = new Logger(WarehouseZonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new warehouse zone within a warehouse location.
   */
  async create(
    organizationId: string,
    dto: CreateWarehouseZoneDto,
    actorUserId?: string,
  ): Promise<WarehouseZoneWithLocation> {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId },
    });

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found in organization`,
      );
    }

    const existing = await this.prisma.warehouseZone.findUnique({
      where: {
        organizationId_locationId_code: {
          organizationId,
          locationId: dto.locationId,
          code: dto.code.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Warehouse zone with code '${dto.code}' already exists in location '${location.name}'`,
      );
    }

    const zone = await this.prisma.warehouseZone.create({
      data: {
        organizationId,
        locationId: dto.locationId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        zoneType: dto.zoneType?.trim() || 'STORAGE',
        description: dto.description?.trim() ?? null,
        isActive: dto.isActive ?? true,
      },
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_ZONE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse_zone.create',
      resource: 'warehouse_zone',
      resourceId: zone.id,
      details: {
        code: zone.code,
        name: zone.name,
        locationId: zone.locationId,
      },
    });

    return zone;
  }

  /**
   * List warehouse zones with filtering and pagination.
   */
  async findAll(
    organizationId: string,
    query: WarehouseZoneQueryDto,
  ): Promise<{
    data: WarehouseZoneWithLocation[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.WarehouseZoneWhereInput = { organizationId };

    if (query.locationId) where.locationId = query.locationId;
    if (query.zoneType) where.zoneType = query.zoneType;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.warehouseZone.findMany({
        where,
        include: {
          location: {
            select: { id: true, code: true, name: true },
          },
        },
        orderBy: [{ location: { code: 'asc' } }, { code: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.warehouseZone.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Find single warehouse zone by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<WarehouseZoneWithLocation> {
    const zone = await this.prisma.warehouseZone.findFirst({
      where: { id, organizationId },
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!zone) {
      throw new NotFoundException(`Warehouse zone with ID ${id} not found`);
    }

    return zone;
  }

  /**
   * Update warehouse zone attributes.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateWarehouseZoneDto,
    actorUserId?: string,
  ): Promise<WarehouseZoneWithLocation> {
    await this.findOne(organizationId, id);

    const updated = await this.prisma.warehouseZone.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        zoneType: dto.zoneType?.trim(),
        description:
          dto.description !== undefined
            ? (dto.description?.trim() ?? null)
            : undefined,
        isActive: dto.isActive,
      },
      include: {
        location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_ZONE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse_zone.update',
      resource: 'warehouse_zone',
      resourceId: updated.id,
      details: { code: updated.code, name: updated.name },
    });

    return updated;
  }
}
