import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCustomerContactDto } from './dto/create-contact.dto';
import { UpdateCustomerContactDto } from './dto/update-contact.dto';
import { CustomerContact, Prisma } from '@prisma/client';

@Injectable()
export class CustomerContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create contact for customer.
   */
  async create(
    organizationId: string,
    customerId: string,
    dto: CreateCustomerContactDto,
    actorUserId?: string,
  ): Promise<CustomerContact> {
    // 1. Verify customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerContact.updateMany({
          where: { customerId, organizationId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const contact = await tx.customerContact.create({
        data: {
          organizationId,
          customerId,
          name: dto.name,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          designation: dto.designation ?? null,
          isPrimary: dto.isPrimary ?? false,
        },
      });

      await this.eventBus.publish({
        eventName: 'CUSTOMER_CONTACT_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'customer_contact.create',
        resource: 'customer_contact',
        resourceId: contact.id,
        details: {
          customerId,
          name: contact.name,
          isPrimary: contact.isPrimary,
        },
      });

      return contact;
    });
  }

  /**
   * List all contacts for customer.
   */
  async findAll(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerContact[]> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return this.prisma.customerContact.findMany({
      where: { customerId, organizationId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Update contact.
   */
  async update(
    organizationId: string,
    customerId: string,
    contactId: string,
    dto: UpdateCustomerContactDto,
    actorUserId?: string,
  ): Promise<CustomerContact> {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId, organizationId },
    });
    if (!contact) {
      throw new NotFoundException(
        `Customer contact with ID ${contactId} not found for this customer`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerContact.updateMany({
          where: { customerId, organizationId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const data: Prisma.CustomerContactUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.email !== undefined) data.email = dto.email ?? null;
      if (dto.phone !== undefined) data.phone = dto.phone ?? null;
      if (dto.designation !== undefined)
        data.designation = dto.designation ?? null;
      if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;

      const updated = await tx.customerContact.update({
        where: { id: contactId },
        data,
      });

      await this.eventBus.publish({
        eventName: 'CUSTOMER_CONTACT_UPDATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'customer_contact.update',
        resource: 'customer_contact',
        resourceId: updated.id,
        details: {
          customerId,
          name: updated.name,
          isPrimary: updated.isPrimary,
        },
      });

      return updated;
    });
  }

  /**
   * Delete contact.
   */
  async remove(
    organizationId: string,
    customerId: string,
    contactId: string,
    actorUserId?: string,
  ): Promise<{ success: boolean }> {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId, organizationId },
    });
    if (!contact) {
      throw new NotFoundException(
        `Customer contact with ID ${contactId} not found for this customer`,
      );
    }

    await this.prisma.customerContact.delete({
      where: { id: contactId },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_CONTACT_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'customer_contact.delete',
      resource: 'customer_contact',
      resourceId: contactId,
      details: { customerId, name: contact.name },
    });

    return { success: true };
  }
}
