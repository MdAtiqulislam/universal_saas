import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ReservationQueryDto } from './dto/reservation-query.dto';
import { ReservationStatus, SalesOrderStatus, Prisma } from '@prisma/client';

export type ReservationWithDetails = Prisma.InventoryReservationGetPayload<{
  include: {
    location: { select: { id: true; code: true; name: true } };
    item: { select: { id: true; sku: true; name: true; trackingType: true } };
    variant: { select: { id: true; sku: true; name: true } };
    salesOrder: {
      select: {
        id: true;
        orderNumber: true;
        status: true;
        customer: { select: { id: true; code: true; name: true } };
      };
    };
  };
}>;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List inventory reservations with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: ReservationQueryDto,
  ): Promise<{
    reservations: ReservationWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryReservationWhereInput = { organizationId };

    if (query.status) where.status = query.status;
    if (query.salesOrderId) where.salesOrderId = query.salesOrderId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.itemId) where.itemId = query.itemId;

    const [total, reservations] = await Promise.all([
      this.prisma.inventoryReservation.count({ where }),
      this.prisma.inventoryReservation.findMany({
        where,
        include: {
          location: { select: { id: true, code: true, name: true } },
          item: {
            select: { id: true, sku: true, name: true, trackingType: true },
          },
          variant: { select: { id: true, sku: true, name: true } },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              customer: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      reservations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single reservation by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ReservationWithDetails> {
    const reservation = await this.prisma.inventoryReservation.findFirst({
      where: { id, organizationId },
      include: {
        location: { select: { id: true, code: true, name: true } },
        item: {
          select: { id: true, sku: true, name: true, trackingType: true },
        },
        variant: { select: { id: true, sku: true, name: true } },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            customer: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException(
        `Inventory reservation with ID ${id} not found`,
      );
    }

    return reservation;
  }

  /**
   * Manually release an active reservation.
   */
  async release(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<ReservationWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== ReservationStatus.ACTIVE) {
      throw new BadRequestException(
        `Only ACTIVE reservations can be released. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Decrement reserved stock from inventory balance
      const balance = await tx.inventoryBalance.findFirst({
        where: {
          organizationId,
          locationId: existing.locationId,
          itemId: existing.itemId,
          variantId: existing.variantId ?? null,
        },
      });

      if (balance) {
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            quantityReserved: {
              decrement: existing.quantity,
            },
          },
        });
      }

      // 2. Decrement quantityReserved on SalesOrderLine
      await tx.salesOrderLine.update({
        where: { id: existing.salesOrderLineId },
        data: {
          quantityReserved: {
            decrement: existing.quantity,
          },
        },
      });

      // 3. Mark reservation as RELEASED
      const released = await tx.inventoryReservation.update({
        where: { id },
        data: {
          status: ReservationStatus.RELEASED,
          releasedAt: new Date(),
        },
        include: {
          location: { select: { id: true, code: true, name: true } },
          item: {
            select: { id: true, sku: true, name: true, trackingType: true },
          },
          variant: { select: { id: true, sku: true, name: true } },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              customer: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      // 4. Recalculate Sales Order Status
      const remainingReservations = await tx.inventoryReservation.findMany({
        where: {
          salesOrderId: existing.salesOrderId,
          status: ReservationStatus.ACTIVE,
        },
      });

      if (remainingReservations.length === 0) {
        await tx.salesOrder.update({
          where: { id: existing.salesOrderId },
          data: { status: SalesOrderStatus.CONFIRMED },
        });
      } else {
        await tx.salesOrder.update({
          where: { id: existing.salesOrderId },
          data: { status: SalesOrderStatus.PARTIALLY_RESERVED },
        });
      }

      return released;
    });

    await this.eventBus.publish({
      eventName: 'INVENTORY_RESERVATION_RELEASED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'inventory_reservation.release',
      resource: 'inventory_reservation',
      resourceId: id,
      details: {
        salesOrderId: existing.salesOrderId,
        quantity: existing.quantity.toString(),
      },
    });

    return updated;
  }
}
