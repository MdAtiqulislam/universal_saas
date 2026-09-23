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
  ServiceOrderStatus,
  InspectionType,
  InspectionLotStatus,
  InspectionDecision,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ServiceQualityIntegrationService {
  private readonly logger = new Logger(ServiceQualityIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async requestQualityCheck(
    organizationId: string,
    serviceOrderId: string,
    userId: string,
  ) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
      include: {
        customerAsset: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${serviceOrderId} not found in this organization.`,
      );
    }

    if (
      order.status === ServiceOrderStatus.COMPLETED ||
      order.status === ServiceOrderStatus.CLOSED ||
      order.status === ServiceOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot request quality check for service order in status: ${order.status}.`,
      );
    }

    // Check if inspection lot already exists
    if (order.inspectionLotId) {
      const existingLot = await this.prisma.qualityInspectionLot.findFirst({
        where: { id: order.inspectionLotId, organizationId },
      });
      if (existingLot) {
        return {
          order,
          inspectionLot: existingLot,
          message: 'Inspection lot already exists for this service order.',
        };
      }
    }

    // Default location & warehouse
    let locationId = order.serviceLocationId;

    if (!locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { organizationId, isActive: true },
      });
      locationId = loc?.id ?? null;
    }

    if (!locationId) {
      throw new BadRequestException(
        'No active warehouse/location found to attach inspection lot.',
      );
    }

    // Generate lotNumber
    let lotNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'QUALITY_INSPECTION_LOT',
        userId,
      );
      lotNumber = seq.formatted;
    } catch {
      const count = await this.prisma.qualityInspectionLot.count({
        where: { organizationId },
      });
      lotNumber = `QIL-${String(count + 1).padStart(6, '0')}`;
    }

    const itemId =
      order.customerAsset?.itemId ||
      (await this.prisma.item.findFirst({ where: { organizationId } }))?.id;

    if (!itemId) {
      throw new BadRequestException(
        'No item found to associate with inspection lot.',
      );
    }

    const inspectionLot = await this.prisma.$transaction(async (tx) => {
      const lot = await tx.qualityInspectionLot.create({
        data: {
          organizationId,
          lotNumber,
          inspectionType: InspectionType.FINISHED_GOODS,
          itemId,
          warehouseId: locationId,
          locationId: locationId,
          customerId: order.customerId,
          totalQuantity: new Prisma.Decimal(1),
          sampleQuantity: new Prisma.Decimal(1),
          status: InspectionLotStatus.PENDING,
          notes: `Post-service quality check for Service Order ${order.serviceOrderNumber}`,
        },
      });

      await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          inspectionLotId: lot.id,
          status: ServiceOrderStatus.QUALITY_CHECK,
        },
      });

      return lot;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_QUALITY_CHECK_REQUESTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'request_quality_check',
      resource: 'service_order',
      resourceId: order.id,
      details: {
        serviceOrderNumber: order.serviceOrderNumber,
        lotNumber: inspectionLot.lotNumber,
      },
    });

    return {
      order,
      inspectionLot,
    };
  }

  async verifyQualityPass(
    organizationId: string,
    serviceOrderId: string,
  ): Promise<boolean> {
    const config = await this.prisma.serviceConfiguration.findFirst({
      where: { organizationId },
    });

    const isInspectionRequired =
      config?.defaultQualityInspectionRequired ?? true;

    if (!isInspectionRequired) {
      return true;
    }

    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
    });

    if (!order || !order.inspectionLotId) {
      return false;
    }

    const lot = await this.prisma.qualityInspectionLot.findFirst({
      where: { id: order.inspectionLotId, organizationId },
    });

    if (!lot) {
      return false;
    }

    return (
      (lot.status === InspectionLotStatus.DECIDED ||
        lot.status === InspectionLotStatus.COMPLETED) &&
      (lot.decision === InspectionDecision.ACCEPT ||
        lot.decision === InspectionDecision.ACCEPT_WITH_DEVIATION)
    );
  }
}
