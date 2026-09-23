import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateCustomerAssetDto,
  UpdateCustomerAssetDto,
  QueryCustomerAssetDto,
} from '../dto/customer-asset.dto';
import {
  CustomerAsset,
  WarrantyStatus,
  CustomerAssetServiceStatus,
  Prisma,
} from '@prisma/client';

export type CustomerAssetWithDetails = Prisma.CustomerAssetGetPayload<{
  include: {
    customer: true;
    item: true;
    variant: true;
    serial: true;
    warranties: {
      include: {
        warrantyPolicy: true;
      };
    };
    serviceRequests: true;
    serviceTickets: true;
    serviceOrders: true;
  };
}>;

@Injectable()
export class CustomerAssetsService {
  private readonly logger = new Logger(CustomerAssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findAll(
    organizationId: string,
    query?: QueryCustomerAssetDto,
  ): Promise<CustomerAssetWithDetails[]> {
    const where: Prisma.CustomerAssetWhereInput = { organizationId };

    if (query?.customerId) where.customerId = query.customerId;
    if (query?.itemId) where.itemId = query.itemId;
    if (query?.warrantyStatus) where.warrantyStatus = query.warrantyStatus;
    if (query?.serviceStatus) where.serviceStatus = query.serviceStatus;
    if (query?.search) {
      where.OR = [
        { assetNumber: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.customerAsset.findMany({
      where,
      include: {
        customer: true,
        item: true,
        variant: true,
        serial: true,
        warranties: {
          include: {
            warrantyPolicy: true,
          },
        },
        serviceRequests: true,
        serviceTickets: true,
        serviceOrders: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<CustomerAssetWithDetails> {
    const asset = await this.prisma.customerAsset.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        item: true,
        variant: true,
        serial: true,
        warranties: {
          include: {
            warrantyPolicy: true,
          },
        },
        serviceRequests: true,
        serviceTickets: true,
        serviceOrders: true,
      },
    });

    if (!asset) {
      throw new NotFoundException(
        `Customer asset with ID ${id} not found in this organization.`,
      );
    }

    return asset;
  }

  async create(
    organizationId: string,
    dto: CreateCustomerAssetDto,
    userId: string,
  ): Promise<CustomerAsset> {
    // 1. Validate customer belongs to tenant
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) {
      throw new BadRequestException(
        `Customer with ID ${dto.customerId} does not belong to this organization.`,
      );
    }

    // 2. Validate item belongs to tenant
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new BadRequestException(
        `Item with ID ${dto.itemId} does not belong to this organization.`,
      );
    }

    // 3. Validate variant if supplied
    if (dto.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: { id: dto.variantId, organizationId, itemId: dto.itemId },
      });
      if (!variant) {
        throw new BadRequestException(
          `Item variant with ID ${dto.variantId} not found for this item.`,
        );
      }
    }

    // 4. Validate serial if supplied
    if (dto.serialId) {
      const serial = await this.prisma.inventorySerial.findFirst({
        where: { id: dto.serialId, organizationId },
      });
      if (!serial) {
        throw new BadRequestException(
          `Serial with ID ${dto.serialId} does not belong to this organization.`,
        );
      }
    }

    const startDate = new Date(dto.warrantyStartDate);
    const endDate = new Date(dto.warrantyEndDate);
    if (endDate < startDate) {
      throw new BadRequestException(
        'Warranty end date cannot be earlier than warranty start date.',
      );
    }

    // Generate assetNumber
    let assetNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'CUSTOMER_ASSET',
        userId,
      );
      assetNumber = seq.formatted;
    } catch {
      const count = await this.prisma.customerAsset.count({
        where: { organizationId },
      });
      assetNumber = `CSA-${String(count + 1).padStart(6, '0')}`;
    }

    const asset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customerAsset.create({
        data: {
          organizationId,
          assetNumber,
          customerId: dto.customerId,
          itemId: dto.itemId,
          variantId: dto.variantId || null,
          serialId: dto.serialId || null,
          serialNumber: dto.serialNumber || null,
          originalSalesOrderId: dto.originalSalesOrderId || null,
          deliveryOrderId: dto.deliveryOrderId || null,
          shipmentId: dto.shipmentId || null,
          customerInvoiceId: dto.customerInvoiceId || null,
          installationDate: dto.installationDate
            ? new Date(dto.installationDate)
            : null,
          purchaseDate: new Date(dto.purchaseDate),
          warrantyStartDate: startDate,
          warrantyEndDate: endDate,
          warrantyStatus: dto.warrantyStatus || WarrantyStatus.ACTIVE,
          serviceStatus:
            dto.serviceStatus || CustomerAssetServiceStatus.OPERATIONAL,
          locationAddress: dto.locationAddress || null,
          notes: dto.notes || null,
        },
      });

      if (dto.warrantyPolicyId) {
        const policy = await tx.warrantyPolicy.findFirst({
          where: { id: dto.warrantyPolicyId, organizationId },
        });
        if (policy) {
          await tx.customerAssetWarranty.create({
            data: {
              organizationId,
              customerAssetId: created.id,
              warrantyPolicyId: policy.id,
              startDate,
              endDate,
              status: dto.warrantyStatus || WarrantyStatus.ACTIVE,
            },
          });
        }
      }

      return created;
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_ASSET_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'create',
      resource: 'customer_asset',
      resourceId: asset.id,
      details: {
        assetNumber: asset.assetNumber,
        customerId: asset.customerId,
        itemId: asset.itemId,
        serialNumber: asset.serialNumber,
      },
    });

    return asset;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerAssetDto,
    userId: string,
  ): Promise<CustomerAsset> {
    const existing = await this.findOne(organizationId, id);

    const updated = await this.prisma.customerAsset.update({
      where: { id: existing.id },
      data: {
        warrantyStatus: dto.warrantyStatus ?? existing.warrantyStatus,
        serviceStatus: dto.serviceStatus ?? existing.serviceStatus,
        installationDate: dto.installationDate
          ? new Date(dto.installationDate)
          : existing.installationDate,
        warrantyEndDate: dto.warrantyEndDate
          ? new Date(dto.warrantyEndDate)
          : existing.warrantyEndDate,
        locationAddress: dto.locationAddress ?? existing.locationAddress,
        notes: dto.notes ?? existing.notes,
      },
    });

    await this.eventBus.publish({
      eventName: 'CUSTOMER_ASSET_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'update',
      resource: 'customer_asset',
      resourceId: updated.id,
      details: {
        assetNumber: updated.assetNumber,
        warrantyStatus: updated.warrantyStatus,
        serviceStatus: updated.serviceStatus,
      },
    });

    return updated;
  }

  async getServiceHistory(organizationId: string, id: string) {
    const asset = await this.prisma.customerAsset.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        item: true,
        variant: true,
        serial: true,
        warranties: {
          include: {
            warrantyPolicy: true,
          },
        },
        serviceRequests: {
          orderBy: { requestedAt: 'desc' },
        },
        serviceTickets: {
          include: {
            diagnoses: {
              include: { technician: true },
            },
            assignments: {
              include: { employee: true },
            },
          },
          orderBy: { openedAt: 'desc' },
        },
        serviceOrders: {
          include: {
            partsRequirements: {
              include: { item: true },
            },
            laborEntries: {
              include: { employee: true },
            },
            handovers: true,
            customerInvoice: true,
            inspectionLot: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(
        `Customer asset with ID ${id} not found in this organization.`,
      );
    }

    return {
      asset,
      totalRequests: asset.serviceRequests.length,
      totalTickets: asset.serviceTickets.length,
      totalOrders: asset.serviceOrders.length,
      warranties: asset.warranties,
      requests: asset.serviceRequests,
      tickets: asset.serviceTickets,
      orders: asset.serviceOrders,
    };
  }
}
