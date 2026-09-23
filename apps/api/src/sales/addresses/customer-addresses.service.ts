import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCustomerAddressDto } from './dto/create-address.dto';
import { UpdateCustomerAddressDto } from './dto/update-address.dto';
import { CustomerAddress, CustomerAddressType, Prisma } from '@prisma/client';

@Injectable()
export class CustomerAddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create address for customer.
   */
  async create(
    organizationId: string,
    customerId: string,
    dto: CreateCustomerAddressDto,
    actorUserId?: string,
  ): Promise<CustomerAddress> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const type = dto.type ?? CustomerAddressType.BILLING;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerAddress.updateMany({
          where: { customerId, organizationId, type, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const address = await tx.customerAddress.create({
        data: {
          organizationId,
          customerId,
          type,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          city: dto.city,
          state: dto.state ?? null,
          postalCode: dto.postalCode ?? null,
          country: dto.country,
          isPrimary: dto.isPrimary ?? false,
        },
      });

      await this.eventBus.publish({
        eventName: 'CUSTOMER_ADDRESS_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'customer_address.create',
        resource: 'customer_address',
        resourceId: address.id,
        details: {
          customerId,
          type: address.type,
          isPrimary: address.isPrimary,
        },
      });

      return address;
    });
  }

  /**
   * List all addresses for customer.
   */
  async findAll(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerAddress[]> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return this.prisma.customerAddress.findMany({
      where: { customerId, organizationId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Update address.
   */
  async update(
    organizationId: string,
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
    actorUserId?: string,
  ): Promise<CustomerAddress> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId, organizationId },
    });
    if (!address) {
      throw new NotFoundException(
        `Customer address with ID ${addressId} not found for this customer`,
      );
    }

    const type = dto.type ?? address.type;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerAddress.updateMany({
          where: { customerId, organizationId, type, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const data: Prisma.CustomerAddressUpdateInput = {};
      if (dto.type !== undefined) data.type = dto.type;
      if (dto.line1 !== undefined) data.line1 = dto.line1;
      if (dto.line2 !== undefined) data.line2 = dto.line2 ?? null;
      if (dto.city !== undefined) data.city = dto.city;
      if (dto.state !== undefined) data.state = dto.state ?? null;
      if (dto.postalCode !== undefined)
        data.postalCode = dto.postalCode ?? null;
      if (dto.country !== undefined) data.country = dto.country;
      if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;

      const updated = await tx.customerAddress.update({
        where: { id: addressId },
        data,
      });

      await this.eventBus.publish({
        eventName: 'CUSTOMER_ADDRESS_UPDATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'customer_address.update',
        resource: 'customer_address',
        resourceId: updated.id,
        details: {
          customerId,
          type: updated.type,
          isPrimary: updated.isPrimary,
        },
      });

      return updated;
    });
  }

  /**
   * Delete address.
   */
  async remove(
    organizationId: string,
    customerId: string,
    addressId: string,
    actorUserId?: string,
  ): Promise<{ success: boolean }> {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId, organizationId },
    });
    if (!address) {
      throw new NotFoundException(
        `Customer address with ID ${addressId} not found for this customer`,
      );
    }

    await this.prisma.customerAddress.delete({
      where: { id: addressId },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_ADDRESS_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_address.delete',
      resource: 'customer_address',
      resourceId: addressId,
      details: { customerId, type: address.type },
    });

    return { success: true };
  }
}
