import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { SupplierContact } from '@prisma/client';

@Injectable()
export class SupplierContactsService {
  private readonly logger = new Logger(SupplierContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List contacts for a supplier.
   */
  async findAll(
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierContact[]> {
    // Verify supplier in tenant
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${supplierId} not found in organization`,
      );
    }

    return this.prisma.supplierContact.findMany({
      where: {
        organizationId,
        supplierId,
      },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Create contact for supplier.
   */
  async create(
    organizationId: string,
    supplierId: string,
    dto: CreateContactDto,
    actorUserId?: string,
  ): Promise<SupplierContact> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${supplierId} not found in organization`,
      );
    }

    const contact = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.supplierContact.updateMany({
          where: { supplierId, organizationId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.supplierContact.create({
        data: {
          organizationId,
          supplierId,
          name: dto.name.trim(),
          email: dto.email ? dto.email.trim() : null,
          phone: dto.phone ? dto.phone.trim() : null,
          designation: dto.designation ? dto.designation.trim() : null,
          isPrimary: dto.isPrimary ?? false,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_CONTACT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier_contact.create',
      resource: 'supplier_contact',
      resourceId: contact.id,
      details: {
        supplierId,
        name: contact.name,
      },
    });

    return contact;
  }

  /**
   * Update supplier contact.
   */
  async update(
    organizationId: string,
    supplierId: string,
    contactId: string,
    dto: UpdateContactDto,
    actorUserId?: string,
  ): Promise<SupplierContact> {
    const existing = await this.prisma.supplierContact.findFirst({
      where: { id: contactId, supplierId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Supplier contact with ID ${contactId} not found`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.supplierContact.updateMany({
          where: {
            supplierId,
            organizationId,
            isPrimary: true,
            id: { not: contactId },
          },
          data: { isPrimary: false },
        });
      }

      return tx.supplierContact.update({
        where: { id: contactId },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
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
          designation:
            dto.designation !== undefined
              ? dto.designation
                ? dto.designation.trim()
                : null
              : undefined,
          isPrimary: dto.isPrimary,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_CONTACT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier_contact.update',
      resource: 'supplier_contact',
      resourceId: updated.id,
      details: {
        supplierId,
        name: updated.name,
      },
    });

    return updated;
  }

  /**
   * Delete supplier contact.
   */
  async remove(
    organizationId: string,
    supplierId: string,
    contactId: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.supplierContact.findFirst({
      where: { id: contactId, supplierId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Supplier contact with ID ${contactId} not found`,
      );
    }

    await this.prisma.supplierContact.delete({
      where: { id: contactId },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_CONTACT_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier_contact.delete',
      resource: 'supplier_contact',
      resourceId: existing.id,
      details: {
        supplierId,
        name: existing.name,
      },
    });

    return {
      success: true,
      message: `Contact '${existing.name}' deleted successfully`,
    };
  }
}
