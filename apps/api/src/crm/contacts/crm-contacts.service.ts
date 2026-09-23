import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  CreateCrmContactDto,
  UpdateCrmContactDto,
  ContactQueryDto,
} from '../dto/contact.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CrmContactsService {
  private readonly logger = new Logger(CrmContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateCrmContactDto,
    actorUserId: string,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId, deletedAt: null },
    });

    if (!customer) {
      throw new BadRequestException(
        `Customer with ID ${dto.customerId} does not exist in this organization.`,
      );
    }

    if (dto.isPrimary) {
      // Clear other primary flags for this customer
      await this.prisma.customerContact.updateMany({
        where: { customerId: dto.customerId, organizationId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await this.prisma.customerContact.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        designation: dto.designation,
        department: dto.department,
        preferredCommunicationMethod: dto.preferredCommunicationMethod,
        isPrimary: dto.isPrimary ?? false,
        isActive: true,
      },
      include: {
        customer: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CONTACT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'create_contact',
      resource: 'customer_contact',
      resourceId: contact.id,
      details: { name: contact.name, customerId: contact.customerId },
    });

    return contact;
  }

  async findAll(organizationId: string, query?: ContactQueryDto) {
    const where: Prisma.CustomerContactWhereInput = { organizationId };

    if (query?.customerId) where.customerId = query.customerId;
    if (query?.isActive !== undefined) where.isActive = query.isActive;

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { designation: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.customerContact.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        opportunities: true,
        quotations: true,
        crmActivities: true,
      },
    });

    if (!contact) {
      throw new NotFoundException(
        `Contact with ID ${id} not found in this organization.`,
      );
    }

    return contact;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCrmContactDto,
    actorUserId: string,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (dto.isPrimary) {
      await this.prisma.customerContact.updateMany({
        where: {
          customerId: existing.customerId,
          organizationId,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    const updated = await this.prisma.customerContact.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        designation: dto.designation,
        department: dto.department,
        preferredCommunicationMethod: dto.preferredCommunicationMethod,
        isPrimary: dto.isPrimary,
        isActive: dto.isActive,
      },
      include: {
        customer: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CONTACT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'update_contact',
      resource: 'customer_contact',
      resourceId: updated.id,
      details: { name: updated.name },
    });

    return updated;
  }

  async delete(organizationId: string, id: string, actorUserId: string) {
    await this.findOne(organizationId, id);

    await this.prisma.customerContact.delete({
      where: { id },
    });

    return { success: true };
  }
}
