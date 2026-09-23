import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { Customer, Prisma } from '@prisma/client';

export type CustomerWithDetails = Prisma.CustomerGetPayload<{
  include: {
    customerGroup: true;
    currency: true;
    contacts: true;
    addresses: true;
    _count: {
      select: {
        quotations: true;
        salesOrders: true;
        deliveryOrders: true;
      };
    };
  };
}>;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new customer within tenant.
   */
  async create(
    organizationId: string,
    dto: CreateCustomerDto,
    actorUserId?: string,
  ): Promise<Customer> {
    const code = dto.code.trim().toUpperCase();

    // 1. Verify code uniqueness
    const existing = await this.prisma.customer.findFirst({
      where: {
        organizationId,
        code,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Customer with code '${code}' already exists in this organization`,
      );
    }

    // 2. Validate customer group if provided
    if (dto.customerGroupId) {
      const group = await this.prisma.customerGroup.findFirst({
        where: {
          id: dto.customerGroupId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!group) {
        throw new BadRequestException(
          `Customer group with ID ${dto.customerGroupId} not found in this organization`,
        );
      }
    }

    // 3. Validate currency if provided
    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: {
          id: dto.currencyId,
          isActive: true,
        },
      });
      if (!currency) {
        throw new BadRequestException(
          `Currency with ID ${dto.currencyId} not found or inactive`,
        );
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        code,
        name: dto.name,
        legalName: dto.legalName ?? null,
        taxNumber: dto.taxNumber ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        customerGroupId: dto.customerGroupId ?? null,
        currencyId: dto.currencyId ?? null,
        paymentTermsDays: dto.paymentTermsDays ?? 0,
        creditLimit:
          dto.creditLimit !== undefined && dto.creditLimit !== null
            ? new Prisma.Decimal(dto.creditLimit)
            : null,
        notes: dto.notes ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer.create',
      resource: 'customer',
      resourceId: customer.id,
      details: { code: customer.code, name: customer.name },
    });

    return customer;
  }

  /**
   * Find customers with pagination and search.
   */
  async findAll(
    organizationId: string,
    query: CustomerQueryDto,
  ): Promise<{
    customers: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.customerGroupId) {
      where.customerGroupId = query.customerGroupId;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: {
          customerGroup: true,
          currency: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single customer with full details.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CustomerWithDetails> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        customerGroup: true,
        currency: true,
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        addresses: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        _count: {
          select: {
            quotations: true,
            salesOrders: true,
            deliveryOrders: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  /**
   * Update customer profile.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerDto,
    actorUserId?: string,
  ): Promise<Customer> {
    await this.findOne(organizationId, id);

    // Validate customer group if updated
    if (dto.customerGroupId) {
      const group = await this.prisma.customerGroup.findFirst({
        where: {
          id: dto.customerGroupId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!group) {
        throw new BadRequestException(
          `Customer group with ID ${dto.customerGroupId} not found in this organization`,
        );
      }
    }

    // Validate currency if updated
    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: {
          id: dto.currencyId,
          isActive: true,
        },
      });
      if (!currency) {
        throw new BadRequestException(
          `Currency with ID ${dto.currencyId} not found or inactive`,
        );
      }
    }

    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.legalName !== undefined) data.legalName = dto.legalName ?? null;
    if (dto.taxNumber !== undefined) data.taxNumber = dto.taxNumber ?? null;
    if (dto.email !== undefined) data.email = dto.email ?? null;
    if (dto.phone !== undefined) data.phone = dto.phone ?? null;
    if (dto.customerGroupId !== undefined) {
      data.customerGroup = dto.customerGroupId
        ? { connect: { id: dto.customerGroupId } }
        : { disconnect: true };
    }
    if (dto.currencyId !== undefined) {
      data.currency = dto.currencyId
        ? { connect: { id: dto.currencyId } }
        : { disconnect: true };
    }
    if (dto.paymentTermsDays !== undefined)
      data.paymentTermsDays = dto.paymentTermsDays;
    if (dto.creditLimit !== undefined) {
      data.creditLimit =
        dto.creditLimit !== null ? new Prisma.Decimal(dto.creditLimit) : null;
    }
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.customer.update({
      where: { id },
      data,
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer.update',
      resource: 'customer',
      resourceId: updated.id,
      details: { code: updated.code, name: updated.name },
    });

    return updated;
  }

  /**
   * Soft-delete customer.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean }> {
    const customer = await this.findOne(organizationId, id);

    await this.prisma.customer.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer.delete',
      resource: 'customer',
      resourceId: id,
      details: { code: customer.code },
    });

    return { success: true };
  }
}
