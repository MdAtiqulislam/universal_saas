import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCustomerGroupDto } from './dto/create-group.dto';
import { UpdateCustomerGroupDto } from './dto/update-group.dto';
import { CustomerGroup, Prisma } from '@prisma/client';

@Injectable()
export class CustomerGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new customer group within tenant.
   */
  async create(
    organizationId: string,
    dto: CreateCustomerGroupDto,
    actorUserId?: string,
  ): Promise<CustomerGroup> {
    const existing = await this.prisma.customerGroup.findFirst({
      where: {
        organizationId,
        code: dto.code,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Customer group with code '${dto.code}' already exists in this organization`,
      );
    }

    const group = await this.prisma.customerGroup.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_GROUP_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_group.create',
      resource: 'customer_group',
      resourceId: group.id,
      details: { code: group.code, name: group.name },
    });

    return group;
  }

  /**
   * List all customer groups for tenant.
   */
  async findAll(
    organizationId: string,
    includeInactive = false,
  ): Promise<CustomerGroup[]> {
    return this.prisma.customerGroup.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Find single customer group by ID.
   */
  async findOne(organizationId: string, id: string): Promise<CustomerGroup> {
    const group = await this.prisma.customerGroup.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!group) {
      throw new NotFoundException(`Customer group with ID ${id} not found`);
    }

    return group;
  }

  /**
   * Update an existing customer group.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerGroupDto,
    actorUserId?: string,
  ): Promise<CustomerGroup> {
    await this.findOne(organizationId, id);

    const data: Prisma.CustomerGroupUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined)
      data.description = dto.description ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.customerGroup.update({
      where: { id },
      data,
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_GROUP_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_group.update',
      resource: 'customer_group',
      resourceId: updated.id,
      details: { code: updated.code, name: updated.name },
    });

    return updated;
  }

  /**
   * Soft-delete a customer group.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean }> {
    const group = await this.findOne(organizationId, id);

    await this.prisma.customerGroup.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_GROUP_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_group.delete',
      resource: 'customer_group',
      resourceId: id,
      details: { code: group.code },
    });

    return { success: true };
  }
}
