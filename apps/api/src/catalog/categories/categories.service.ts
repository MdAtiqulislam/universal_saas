import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from '@prisma/client';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all categories for a specific organization.
   */
  async findAll(
    organizationId: string,
    filter?: { isActive?: boolean; search?: string },
  ): Promise<Category[]> {
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

    return this.prisma.category.findMany({
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
   * Find a single category by ID within an organization.
   */
  async findOne(organizationId: string, id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
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
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${id} not found in organization`,
      );
    }

    return category;
  }

  /**
   * Create a new category within an organization.
   */
  async create(
    organizationId: string,
    dto: CreateCategoryDto,
    actorUserId?: string,
  ): Promise<Category> {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.category.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Category code '${normalizedCode}' already exists in this organization`,
      );
    }

    // Validate parent if specified
    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: {
          id: dto.parentId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!parent) {
        throw new BadRequestException(
          `Parent category '${dto.parentId}' does not exist in this organization`,
        );
      }
    }

    const category = await this.prisma.category.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        code: normalizedCode,
        description: dto.description?.trim() ?? null,
        parentId: dto.parentId ?? null,
        isActive: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CATEGORY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'category.create',
      resource: 'category',
      resourceId: category.id,
      details: {
        code: category.code,
        name: category.name,
      },
    });

    return category;
  }

  /**
   * Update category attributes.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateCategoryDto,
    actorUserId?: string,
  ): Promise<Category> {
    const existing = await this.prisma.category.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Category with ID ${id} not found in organization`,
      );
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      if (dto.parentId !== null) {
        const parent = await this.prisma.category.findFirst({
          where: {
            id: dto.parentId,
            organizationId,
            deletedAt: null,
          },
        });

        if (!parent) {
          throw new BadRequestException(
            `Parent category '${dto.parentId}' does not exist in this organization`,
          );
        }
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description:
          dto.description !== undefined
            ? dto.description
              ? dto.description.trim()
              : null
            : undefined,
        parentId: dto.parentId !== undefined ? dto.parentId : undefined,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'CATEGORY_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'category.update',
      resource: 'category',
      resourceId: updated.id,
      details: {
        code: updated.code,
        name: updated.name,
      },
    });

    return updated;
  }

  /**
   * Soft-delete/archive a category.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.category.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Category with ID ${id} not found in organization`,
      );
    }

    await this.prisma.category.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'CATEGORY_ARCHIVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'category.archive',
      resource: 'category',
      resourceId: existing.id,
      details: {
        code: existing.code,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Category '${existing.name}' (${existing.code}) archived successfully`,
    };
  }
}
