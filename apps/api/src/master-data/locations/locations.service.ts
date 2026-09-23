import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Location } from '@prisma/client';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all locations for a specific organization.
   */
  async findAll(
    organizationId: string,
    filter?: { isActive?: boolean; type?: string; search?: string },
  ): Promise<Location[]> {
    const where: Record<string, unknown> = {
      organizationId,
      deletedAt: null,
    };

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.type) {
      where.type = filter.type.trim().toUpperCase();
    }

    if (filter?.search) {
      const searchTerm = filter.search.trim();
      where.OR = [
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.location.findMany({
      where,
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Find a single location by ID within an organization.
   */
  async findOne(organizationId: string, id: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            isActive: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${id} not found in organization`,
      );
    }

    return location;
  }

  /**
   * Create a new location within an organization.
   */
  async create(
    organizationId: string,
    dto: CreateLocationDto,
    actorUserId?: string,
  ): Promise<Location> {
    const normalizedCode = dto.code.trim().toUpperCase();

    // Check code uniqueness within organization
    const existing = await this.prisma.location.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Location code '${normalizedCode}' already exists in this organization`,
      );
    }

    // Validate parent location if specified
    if (dto.parentId) {
      const parent = await this.prisma.location.findFirst({
        where: {
          id: dto.parentId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!parent) {
        throw new BadRequestException(
          `Parent location '${dto.parentId}' does not exist in this organization`,
        );
      }
    }

    const location = await this.prisma.location.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        code: normalizedCode,
        type: dto.type ? dto.type.trim().toUpperCase() : 'BRANCH',
        parentId: dto.parentId ?? null,
        addressLine1: dto.addressLine1?.trim() ?? null,
        addressLine2: dto.addressLine2?.trim() ?? null,
        city: dto.city?.trim() ?? null,
        state: dto.state?.trim() ?? null,
        postalCode: dto.postalCode?.trim() ?? null,
        countryCode: dto.countryCode?.trim().toUpperCase() ?? null,
        isActive: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'LOCATION_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'location.create',
      resource: 'location',
      resourceId: location.id,
      details: {
        name: location.name,
        code: location.code,
        type: location.type,
      },
    });

    return location;
  }

  /**
   * Update location within an organization.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateLocationDto,
    actorUserId?: string,
  ): Promise<Location> {
    const existing = await this.prisma.location.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Location with ID ${id} not found in organization`,
      );
    }

    // Validate parent hierarchy if updated
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A location cannot be its own parent');
      }

      if (dto.parentId !== null) {
        const parent = await this.prisma.location.findFirst({
          where: {
            id: dto.parentId,
            organizationId,
            deletedAt: null,
          },
        });

        if (!parent) {
          throw new BadRequestException(
            `Parent location '${dto.parentId}' does not exist in this organization`,
          );
        }
      }
    }

    const updated = await this.prisma.location.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        type:
          dto.type !== undefined ? dto.type.trim().toUpperCase() : undefined,
        parentId: dto.parentId !== undefined ? dto.parentId : undefined,
        addressLine1:
          dto.addressLine1 !== undefined
            ? dto.addressLine1
              ? dto.addressLine1.trim()
              : null
            : undefined,
        addressLine2:
          dto.addressLine2 !== undefined
            ? dto.addressLine2
              ? dto.addressLine2.trim()
              : null
            : undefined,
        city:
          dto.city !== undefined
            ? dto.city
              ? dto.city.trim()
              : null
            : undefined,
        state:
          dto.state !== undefined
            ? dto.state
              ? dto.state.trim()
              : null
            : undefined,
        postalCode:
          dto.postalCode !== undefined
            ? dto.postalCode
              ? dto.postalCode.trim()
              : null
            : undefined,
        countryCode:
          dto.countryCode !== undefined
            ? dto.countryCode
              ? dto.countryCode.trim().toUpperCase()
              : null
            : undefined,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'LOCATION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'location.update',
      resource: 'location',
      resourceId: updated.id,
      details: {
        name: updated.name,
        code: updated.code,
      },
    });

    return updated;
  }

  /**
   * Soft-delete a location.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.location.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Location with ID ${id} not found in organization`,
      );
    }

    // Check if active children exist
    const childCount = await this.prisma.location.count({
      where: {
        parentId: id,
        organizationId,
        deletedAt: null,
      },
    });

    if (childCount > 0) {
      throw new ConflictException(
        'Cannot delete a location that has active child locations',
      );
    }

    await this.prisma.location.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'LOCATION_ARCHIVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'location.archive',
      resource: 'location',
      resourceId: existing.id,
      details: {
        code: existing.code,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Location '${existing.name}' (${existing.code}) archived successfully`,
    };
  }
}
