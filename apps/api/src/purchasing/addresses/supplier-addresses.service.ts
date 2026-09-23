import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { SupplierAddress, SupplierAddressType } from '@prisma/client';

@Injectable()
export class SupplierAddressesService {
  private readonly logger = new Logger(SupplierAddressesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all addresses for a supplier.
   */
  async findAll(
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierAddress[]> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${supplierId} not found in organization`,
      );
    }

    return this.prisma.supplierAddress.findMany({
      where: {
        organizationId,
        supplierId,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Create an address for a supplier.
   */
  async create(
    organizationId: string,
    supplierId: string,
    dto: CreateAddressDto,
    actorUserId?: string,
  ): Promise<SupplierAddress> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId, deletedAt: null },
    });

    if (!supplier) {
      throw new NotFoundException(
        `Supplier with ID ${supplierId} not found in organization`,
      );
    }

    const type = dto.type ?? SupplierAddressType.BILLING;

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.supplierAddress.updateMany({
          where: { supplierId, organizationId, type, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.supplierAddress.create({
        data: {
          organizationId,
          supplierId,
          type,
          line1: dto.line1.trim(),
          line2: dto.line2 ? dto.line2.trim() : null,
          city: dto.city.trim(),
          state: dto.state ? dto.state.trim() : null,
          postalCode: dto.postalCode ? dto.postalCode.trim() : null,
          country: dto.country.trim().toUpperCase(),
          isPrimary: dto.isPrimary ?? false,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_ADDRESS_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier_address.create',
      resource: 'supplier_address',
      resourceId: address.id,
      details: {
        supplierId,
        type: address.type,
        city: address.city,
      },
    });

    return address;
  }

  /**
   * Update a supplier address.
   */
  async update(
    organizationId: string,
    supplierId: string,
    addressId: string,
    dto: UpdateAddressDto,
    actorUserId?: string,
  ): Promise<SupplierAddress> {
    const existing = await this.prisma.supplierAddress.findFirst({
      where: { id: addressId, supplierId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Supplier address with ID ${addressId} not found`,
      );
    }

    const targetType = dto.type ?? existing.type;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.supplierAddress.updateMany({
          where: {
            supplierId,
            organizationId,
            type: targetType,
            isPrimary: true,
            id: { not: addressId },
          },
          data: { isPrimary: false },
        });
      }

      return tx.supplierAddress.update({
        where: { id: addressId },
        data: {
          type: dto.type,
          line1: dto.line1 !== undefined ? dto.line1.trim() : undefined,
          line2:
            dto.line2 !== undefined
              ? dto.line2
                ? dto.line2.trim()
                : null
              : undefined,
          city: dto.city !== undefined ? dto.city.trim() : undefined,
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
          country:
            dto.country !== undefined
              ? dto.country.trim().toUpperCase()
              : undefined,
          isPrimary: dto.isPrimary,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_ADDRESS_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier_address.update',
      resource: 'supplier_address',
      resourceId: updated.id,
      details: {
        supplierId,
        type: updated.type,
      },
    });

    return updated;
  }

  /**
   * Delete supplier address.
   */
  async remove(
    organizationId: string,
    supplierId: string,
    addressId: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.supplierAddress.findFirst({
      where: { id: addressId, supplierId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Supplier address with ID ${addressId} not found`,
      );
    }

    await this.prisma.supplierAddress.delete({
      where: { id: addressId },
    });

    await this.eventBus.publish({
      eventName: 'SUPPLIER_ADDRESS_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'supplier_address.delete',
      resource: 'supplier_address',
      resourceId: existing.id,
      details: {
        supplierId,
        type: existing.type,
      },
    });

    return {
      success: true,
      message: `Address deleted successfully`,
    };
  }
}
