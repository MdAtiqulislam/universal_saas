import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ProcessServiceHandoverDto } from '../dto/service-handover.dto';
import {
  ServiceHandover,
  ServiceOrderStatus,
  CustomerAssetServiceStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ServiceHandoverService {
  private readonly logger = new Logger(ServiceHandoverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findByServiceOrder(
    organizationId: string,
    serviceOrderId: string,
  ): Promise<ServiceHandover[]> {
    return this.prisma.serviceHandover.findMany({
      where: { organizationId, serviceOrderId },
      orderBy: { handoverDate: 'desc' },
    });
  }

  async processHandover(
    organizationId: string,
    serviceOrderId: string,
    dto: ProcessServiceHandoverDto,
    userId: string,
  ): Promise<ServiceHandover> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
      include: { customerAsset: true },
    });

    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${serviceOrderId} not found in this organization.`,
      );
    }

    if (
      order.status !== ServiceOrderStatus.COMPLETED &&
      order.status !== ServiceOrderStatus.QUALITY_CHECK
    ) {
      throw new BadRequestException(
        `Cannot handover service order in status: ${order.status}. Must be COMPLETED.`,
      );
    }

    const handoverDate = dto.handoverDate
      ? new Date(dto.handoverDate)
      : new Date();

    const handover = await this.prisma.$transaction(async (tx) => {
      const h = await tx.serviceHandover.create({
        data: {
          organizationId,
          serviceOrderId: order.id,
          handoverDate,
          recipientName: dto.recipientName.trim(),
          recipientContact: dto.recipientContact || null,
          acceptanceNotes: dto.acceptanceNotes || null,
          deliveryReference: dto.deliveryReference || null,
          handoverByUserId: userId,
        },
      });

      // Update ServiceOrder
      await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: ServiceOrderStatus.HANDED_OVER,
          actualEndAt: order.actualEndAt || handoverDate,
        },
      });

      // Update CustomerAsset serviceStatus if linked
      if (order.customerAssetId) {
        await tx.customerAsset.update({
          where: { id: order.customerAssetId },
          data: {
            serviceStatus: CustomerAssetServiceStatus.OPERATIONAL,
          },
        });
      }

      return h;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_HANDED_OVER',
      occurredAt: handoverDate,
      organizationId,
      actorUserId: userId,
      action: 'process_handover',
      resource: 'service_order',
      resourceId: order.id,
      details: {
        serviceOrderNumber: order.serviceOrderNumber,
        recipientName: dto.recipientName,
        handoverDate: handoverDate.toISOString(),
      },
    });

    return handover;
  }
}
