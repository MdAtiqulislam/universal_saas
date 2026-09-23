import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PlannedOrderQueryDto } from './dto/planning-query.dto';
import { PlannedOrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class PlannedOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * List planned order recommendations with query filters.
   */
  async findAll(organizationId: string, query: PlannedOrderQueryDto) {
    const where: Prisma.PlannedOrderWhereInput = { organizationId };

    if (query.action) where.action = query.action;
    if (query.status) where.status = query.status;
    if (query.itemId) where.itemId = query.itemId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.supplierId) where.supplierId = query.supplierId;

    if (query.startDate || query.endDate) {
      where.requiredDate = {};
      if (query.startDate) where.requiredDate.gte = new Date(query.startDate);
      if (query.endDate) where.requiredDate.lte = new Date(query.endDate);
    }

    return this.prisma.plannedOrder.findMany({
      where,
      include: {
        item: true,
        variant: true,
        location: true,
        supplier: true,
        bom: true,
        planningRun: true,
      },
      orderBy: [{ requiredDate: 'asc' }, { orderNumber: 'asc' }],
    });
  }

  /**
   * Find single planned order by ID.
   */
  async findOne(organizationId: string, id: string) {
    const order = await this.prisma.plannedOrder.findFirst({
      where: { id, organizationId },
      include: {
        item: true,
        variant: true,
        location: true,
        supplier: true,
        bom: true,
        planningRun: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Planned order with ID ${id} not found.`);
    }

    return order;
  }

  /**
   * Update planned order status (e.g. ACCEPT, REJECT, CANCEL).
   */
  async updateStatus(
    organizationId: string,
    id: string,
    status: PlannedOrderStatus,
    userId: string,
  ) {
    const order = await this.findOne(organizationId, id);

    if (order.status === PlannedOrderStatus.CONVERTED) {
      throw new BadRequestException(
        `Cannot modify planned order that has already been converted.`,
      );
    }

    const updated = await this.prisma.plannedOrder.update({
      where: { id },
      data: { status },
      include: { item: true, supplier: true, bom: true },
    });

    await this.eventBus.publish({
      eventName: 'MRP_PLANNED_ORDER_GENERATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'planning.order.status_update',
      resource: 'planned_order',
      resourceId: updated.id,
      details: {
        orderNumber: updated.orderNumber,
        status: updated.status,
      },
    });

    return updated;
  }
}
