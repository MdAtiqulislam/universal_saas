import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  ServiceOrder,
  ServiceOrderStatus,
  WarrantyStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ServiceRmaIntegrationService {
  private readonly logger = new Logger(ServiceRmaIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async createServiceOrderFromRma(
    organizationId: string,
    rmaId: string,
    userId: string,
  ): Promise<ServiceOrder> {
    const rma = await this.prisma.returnRequest.findFirst({
      where: { id: rmaId, organizationId },
      include: {
        customer: true,
        lines: { include: { item: true, variant: true } },
      },
    });

    if (!rma) {
      throw new NotFoundException(
        `Return request with ID ${rmaId} not found in this organization.`,
      );
    }

    if (!rma.customerId) {
      throw new BadRequestException(
        'Cannot create a service order for non-customer return request.',
      );
    }

    // Check if service order already exists for this RMA
    const existingOrder = await this.prisma.serviceOrder.findFirst({
      where: { sourceRmaId: rma.id, organizationId },
    });
    if (existingOrder) {
      throw new ConflictException(
        `A service order already exists for return request ${rma.returnNumber} (Order: ${existingOrder.serviceOrderNumber}).`,
      );
    }

    // Look up or find CustomerAsset
    const primaryLine = rma.lines[0];
    let customerAssetId: string | null = null;
    if (primaryLine) {
      const asset = await this.prisma.customerAsset.findFirst({
        where: {
          organizationId,
          customerId: rma.customerId,
          itemId: primaryLine.itemId,
        },
      });
      if (asset) {
        customerAssetId = asset.id;
      }
    }

    // Generate serviceOrderNumber
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
        customerId: rma.customerId,
        customerAssetId,
        sourceRmaId: rma.id,
        status: ServiceOrderStatus.RELEASED,
        warrantyStatus: WarrantyStatus.ACTIVE,
        scheduledStartAt: now,
      },
      include: {
        customer: true,
        customerAsset: true,
        sourceRma: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_CREATED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'create_from_rma',
      resource: 'service_order',
      resourceId: order.id,
      details: {
        serviceOrderNumber: order.serviceOrderNumber,
        rmaNumber: rma.returnNumber,
      },
    });

    return order;
  }
}
