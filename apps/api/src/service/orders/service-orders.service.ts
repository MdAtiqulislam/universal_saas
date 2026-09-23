import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ServiceQualityIntegrationService } from '../quality/service-quality-integration.service';
import { ServiceCostingService } from '../costing/service-costing.service';
import {
  CreateServiceOrderDto,
  UpdateServiceOrderDto,
  QueryServiceOrderDto,
} from '../dto/service-order.dto';
import {
  ServiceOrder,
  ServiceOrderStatus,
  CustomerAssetServiceStatus,
  WarrantyStatus,
  Prisma,
} from '@prisma/client';

export type ServiceOrderWithDetails = Prisma.ServiceOrderGetPayload<{
  include: {
    customer: true;
    customerAsset: true;
    serviceLocation: true;
    assignedTechnician: true;
    estimate: true;
    customerInvoice: true;
    sourceRma: true;
    inspectionLot: true;
    partsRequirements: {
      include: { item: true; variant: true };
    };
    laborEntries: {
      include: { employee: true };
    };
    handovers: true;
  };
}>;

@Injectable()
export class ServiceOrdersService {
  private readonly logger = new Logger(ServiceOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly qualityIntegrationService: ServiceQualityIntegrationService,
    private readonly costingService: ServiceCostingService,
  ) {}

  async findAll(
    organizationId: string,
    query?: QueryServiceOrderDto,
  ): Promise<ServiceOrderWithDetails[]> {
    const where: Prisma.ServiceOrderWhereInput = { organizationId };

    if (query?.customerId) where.customerId = query.customerId;
    if (query?.customerAssetId) where.customerAssetId = query.customerAssetId;
    if (query?.status) where.status = query.status;
    if (query?.assignedTechnicianId)
      where.assignedTechnicianId = query.assignedTechnicianId;
    if (query?.sourceRmaId) where.sourceRmaId = query.sourceRmaId;
    if (query?.search) {
      where.OR = [
        { serviceOrderNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.serviceOrder.findMany({
      where,
      include: {
        customer: true,
        customerAsset: true,
        serviceLocation: true,
        assignedTechnician: true,
        estimate: true,
        customerInvoice: true,
        sourceRma: true,
        inspectionLot: true,
        partsRequirements: {
          include: { item: true, variant: true },
        },
        laborEntries: {
          include: { employee: true },
        },
        handovers: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ServiceOrderWithDetails> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        customerAsset: true,
        serviceLocation: true,
        assignedTechnician: true,
        estimate: true,
        customerInvoice: true,
        sourceRma: true,
        inspectionLot: true,
        partsRequirements: {
          include: { item: true, variant: true },
        },
        laborEntries: {
          include: { employee: true },
        },
        handovers: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${id} not found in this organization.`,
      );
    }

    return order;
  }

  async create(
    organizationId: string,
    dto: CreateServiceOrderDto,
    userId: string,
  ): Promise<ServiceOrder> {
    // 1. Validate customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) {
      throw new BadRequestException(
        `Customer with ID ${dto.customerId} does not belong to this organization.`,
      );
    }

    // 2. Validate asset if supplied
    if (dto.customerAssetId) {
      const asset = await this.prisma.customerAsset.findFirst({
        where: { id: dto.customerAssetId, organizationId },
      });
      if (!asset) {
        throw new BadRequestException(
          `Customer asset with ID ${dto.customerAssetId} does not belong to this organization.`,
        );
      }
    }

    // 3. Generate serviceOrderNumber
    let serviceOrderNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'SERVICE_ORDER',
        userId,
      );
      serviceOrderNumber = seq.formatted;
    } catch {
      const count = await this.prisma.serviceOrder.count({
        where: { organizationId },
      });
      serviceOrderNumber = `SVO-${String(count + 1).padStart(6, '0')}`;
    }

    const now = new Date();

    const order = await this.prisma.serviceOrder.create({
      data: {
        organizationId,
        serviceOrderNumber,
        serviceTicketId: dto.serviceTicketId || null,
        customerId: dto.customerId,
        customerAssetId: dto.customerAssetId || null,
        serviceLocationId: dto.serviceLocationId || null,
        assignedTechnicianId: dto.assignedTechnicianId || null,
        warrantyStatus: dto.warrantyStatus || WarrantyStatus.NOT_APPLICABLE,
        estimateId: dto.estimateId || null,
        scheduledStartAt: dto.scheduledStartAt
          ? new Date(dto.scheduledStartAt)
          : now,
        scheduledEndAt: dto.scheduledEndAt
          ? new Date(dto.scheduledEndAt)
          : null,
        sourceRmaId: dto.sourceRmaId || null,
        status: ServiceOrderStatus.DRAFT,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_CREATED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'create',
      resource: 'service_order',
      resourceId: order.id,
      details: {
        serviceOrderNumber: order.serviceOrderNumber,
        customerId: order.customerId,
      },
    });

    return order;
  }

  async release(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<ServiceOrder> {
    const order = await this.findOne(organizationId, id);

    if (order.status !== ServiceOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot release service order in status: ${order.status}.`,
      );
    }

    const updated = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: ServiceOrderStatus.RELEASED },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_RELEASED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'release',
      resource: 'service_order',
      resourceId: updated.id,
      details: {
        serviceOrderNumber: updated.serviceOrderNumber,
      },
    });

    return updated;
  }

  async start(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<ServiceOrder> {
    const order = await this.findOne(organizationId, id);

    if (
      order.status !== ServiceOrderStatus.DRAFT &&
      order.status !== ServiceOrderStatus.RELEASED
    ) {
      throw new BadRequestException(
        `Cannot start service order in status: ${order.status}.`,
      );
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const o = await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: ServiceOrderStatus.IN_PROGRESS,
          actualStartAt: order.actualStartAt || now,
        },
      });

      if (order.customerAssetId) {
        await tx.customerAsset.update({
          where: { id: order.customerAssetId },
          data: {
            serviceStatus: CustomerAssetServiceStatus.UNDER_SERVICE,
          },
        });
      }

      return o;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_STARTED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'start',
      resource: 'service_order',
      resourceId: updated.id,
      details: {
        serviceOrderNumber: updated.serviceOrderNumber,
      },
    });

    return updated;
  }

  async complete(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<ServiceOrder> {
    const order = await this.findOne(organizationId, id);

    if (
      order.status === ServiceOrderStatus.COMPLETED ||
      order.status === ServiceOrderStatus.HANDED_OVER ||
      order.status === ServiceOrderStatus.CLOSED
    ) {
      return order;
    }

    if (
      order.status !== ServiceOrderStatus.IN_PROGRESS &&
      order.status !== ServiceOrderStatus.PARTIALLY_COMPLETED &&
      order.status !== ServiceOrderStatus.QUALITY_CHECK
    ) {
      throw new BadRequestException(
        `Cannot complete service order in status: ${order.status}.`,
      );
    }

    // Verify quality pass if required
    const qualityPassed =
      await this.qualityIntegrationService.verifyQualityPass(
        organizationId,
        order.id,
      );

    if (!qualityPassed) {
      throw new BadRequestException(
        'Quality inspection lot is required and has not passed inspection yet.',
      );
    }

    // Recalculate costing
    await this.costingService.recalculateAndPersist(organizationId, order.id);

    const now = new Date();

    const updated = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: ServiceOrderStatus.COMPLETED,
        actualEndAt: now,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_COMPLETED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'complete',
      resource: 'service_order',
      resourceId: updated.id,
      details: {
        serviceOrderNumber: updated.serviceOrderNumber,
        totalCost: updated.totalCost.toString(),
        customerCharge: updated.customerCharge.toString(),
      },
    });

    return updated;
  }

  async close(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<ServiceOrder> {
    const order = await this.findOne(organizationId, id);

    if (order.status === ServiceOrderStatus.CLOSED) {
      return order;
    }

    if (
      order.status !== ServiceOrderStatus.COMPLETED &&
      order.status !== ServiceOrderStatus.HANDED_OVER
    ) {
      throw new BadRequestException(
        `Cannot close service order in status: ${order.status}. Must be COMPLETED or HANDED_OVER.`,
      );
    }

    const updated = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: {
        status: ServiceOrderStatus.CLOSED,
        isImmutable: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'close',
      resource: 'service_order',
      resourceId: updated.id,
      details: {
        serviceOrderNumber: updated.serviceOrderNumber,
      },
    });

    return updated;
  }

  async cancel(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<ServiceOrder> {
    const order = await this.findOne(organizationId, id);

    if (
      order.status === ServiceOrderStatus.CLOSED ||
      order.status === ServiceOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel service order in status: ${order.status}.`,
      );
    }

    const updated = await this.prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: ServiceOrderStatus.CANCELLED },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'cancel',
      resource: 'service_order',
      resourceId: updated.id,
      details: {
        serviceOrderNumber: updated.serviceOrderNumber,
      },
    });

    return updated;
  }
}
