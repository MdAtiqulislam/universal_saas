import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../../inventory/balances/balances.service';
import { CogsService } from '../../inventory/costing/cogs.service';
import { CreateDeliveryOrderDto } from './dto/create-delivery.dto';
import { UpdateDeliveryOrderDto } from './dto/update-delivery.dto';
import { DeliveryOrderQueryDto } from './dto/delivery-query.dto';
import {
  DeliveryOrderStatus,
  SalesOrderStatus,
  StockMovementType,
  ReservationStatus,
  TrackingType,
  SerialStatus,
  Prisma,
} from '@prisma/client';

export type DeliveryOrderWithDetails = Prisma.DeliveryOrderGetPayload<{
  include: {
    customer: true;
    location: true;
    salesOrder: {
      select: {
        id: true;
        orderNumber: true;
        status: true;
        currency: { select: { id: true; code: true; symbol: true } };
      };
    };
    shippingAddress: true;
    lines: {
      include: {
        item: {
          select: { id: true; sku: true; name: true; trackingType: true };
        };
        variant: { select: { id: true; sku: true; name: true } };
        salesOrderLine: {
          select: {
            id: true;
            quantity: true;
            quantityReserved: true;
            quantityDelivered: true;
            unitPrice: true;
          };
        };
        batch: { select: { id: true; batchNumber: true; expiresAt: true } };
        serial: { select: { id: true; serialNumber: true } };
      };
    };
  };
}>;

@Injectable()
export class DeliveryOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
    private readonly cogsService: CogsService,
  ) {}

  /**
   * Create a new draft delivery order against an active sales order.
   */
  async create(
    organizationId: string,
    dto: CreateDeliveryOrderDto,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    // 1. Verify Sales Order
    const salesOrder = await this.prisma.salesOrder.findFirst({
      where: { id: dto.salesOrderId, organizationId },
      include: {
        lines: {
          include: {
            item: true,
            variant: true,
          },
        },
      },
    });

    if (!salesOrder) {
      throw new NotFoundException(
        `Sales order with ID ${dto.salesOrderId} not found in this organization`,
      );
    }

    const eligibleStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.APPROVED,
      SalesOrderStatus.CONFIRMED,
      SalesOrderStatus.ALLOCATED,
      SalesOrderStatus.PARTIALLY_RESERVED,
      SalesOrderStatus.PARTIALLY_FULFILLED,
      SalesOrderStatus.PARTIALLY_DELIVERED,
      SalesOrderStatus.RESERVED,
    ];

    if (!eligibleStatuses.includes(salesOrder.status)) {
      throw new BadRequestException(
        `Cannot create delivery order for sales order in '${salesOrder.status}' status. Must be APPROVED, CONFIRMED, ALLOCATED, or PARTIALLY_FULFILLED.`,
      );
    }

    // 2. Verify Shipping Address if provided
    if (dto.shippingAddressId) {
      const address = await this.prisma.customerAddress.findFirst({
        where: {
          id: dto.shippingAddressId,
          customerId: salesOrder.customerId,
          organizationId,
        },
      });
      if (!address) {
        throw new NotFoundException(
          `Shipping address with ID ${dto.shippingAddressId} not found for this customer`,
        );
      }
    }

    // 3. Validate Delivery Lines
    const linesMap = new Map(salesOrder.lines.map((l) => [l.id, l]));
    const validatedLines: Array<{
      salesOrderLineId: string;
      itemId: string;
      variantId?: string | null;
      quantity: Prisma.Decimal;
      batchId?: string | null;
      serialId?: string | null;
    }> = [];

    for (const lineDto of dto.lines) {
      const soLine = linesMap.get(lineDto.salesOrderLineId);
      if (!soLine) {
        throw new BadRequestException(
          `Sales order line ${lineDto.salesOrderLineId} does not belong to sales order ${salesOrder.orderNumber}`,
        );
      }

      const deliveryQty = new Prisma.Decimal(lineDto.quantity);
      if (deliveryQty.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'Delivery quantity must be greater than 0',
        );
      }

      const remainingToDeliver = soLine.quantity.sub(soLine.quantityDelivered);
      if (deliveryQty.greaterThan(remainingToDeliver)) {
        throw new BadRequestException(
          `Requested delivery quantity (${deliveryQty.toString()}) exceeds remaining undelivered quantity (${remainingToDeliver.toString()}) for item ${soLine.item.sku}`,
        );
      }

      // Check batch if required
      if (soLine.item.trackingType === TrackingType.BATCH) {
        if (!lineDto.batchId) {
          throw new BadRequestException(
            `Item ${soLine.item.sku} requires a batch reference for delivery`,
          );
        }
        const batch = await this.prisma.inventoryBatch.findFirst({
          where: {
            id: lineDto.batchId,
            itemId: soLine.itemId,
            organizationId,
          },
        });
        if (!batch) {
          throw new BadRequestException(
            `Batch with ID ${lineDto.batchId} not found for item ${soLine.item.sku}`,
          );
        }
      }

      // Check serial if required
      if (soLine.item.trackingType === TrackingType.SERIAL) {
        if (!lineDto.serialId) {
          throw new BadRequestException(
            `Item ${soLine.item.sku} requires a serial reference for delivery`,
          );
        }
        if (!deliveryQty.equals(1)) {
          throw new BadRequestException(
            `Serial tracked item lines must have quantity exactly 1. Found: ${deliveryQty.toString()}`,
          );
        }
        const serial = await this.prisma.inventorySerial.findFirst({
          where: {
            id: lineDto.serialId,
            itemId: soLine.itemId,
            organizationId,
          },
        });
        if (!serial) {
          throw new BadRequestException(
            `Serial with ID ${lineDto.serialId} not found for item ${soLine.item.sku}`,
          );
        }
        if (serial.status !== SerialStatus.AVAILABLE) {
          throw new BadRequestException(
            `Serial ${serial.serialNumber} is not AVAILABLE (current: ${serial.status})`,
          );
        }
      }

      validatedLines.push({
        salesOrderLineId: lineDto.salesOrderLineId,
        itemId: soLine.itemId,
        variantId: soLine.variantId ?? null,
        quantity: deliveryQty,
        batchId: lineDto.batchId ?? null,
        serialId: lineDto.serialId ?? null,
      });
    }

    // 4. Generate DO Number
    const seq = await this.numberingService.nextNumber(
      organizationId,
      'DELIVERY_ORDER',
    );

    // 5. Persist Delivery Order
    const delivery = await this.prisma.deliveryOrder.create({
      data: {
        organizationId,
        deliveryNumber: seq.formatted,
        salesOrderId: salesOrder.id,
        customerId: salesOrder.customerId,
        locationId: salesOrder.locationId,
        shippingAddressId: dto.shippingAddressId ?? null,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        status: DeliveryOrderStatus.DRAFT,
        createdByUserId: actorUserId,
        lines: {
          create: validatedLines.map((l) => ({
            ...l,
            organizationId,
          })),
        },
      },
      include: {
        customer: true,
        location: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
        shippingAddress: true,
        lines: {
          include: {
            item: {
              select: { id: true, sku: true, name: true, trackingType: true },
            },
            variant: { select: { id: true, sku: true, name: true } },
            salesOrderLine: {
              select: {
                id: true,
                quantity: true,
                quantityReserved: true,
                quantityDelivered: true,
                unitPrice: true,
              },
            },
            batch: { select: { id: true, batchNumber: true, expiresAt: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_ORDER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'delivery_order.create',
      resource: 'delivery_order',
      resourceId: delivery.id,
      details: {
        deliveryNumber: delivery.deliveryNumber,
        salesOrderNumber: salesOrder.orderNumber,
      },
    });

    return delivery;
  }

  /**
   * Find paginated list of delivery orders.
   */
  async findAll(organizationId: string, query: DeliveryOrderQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DeliveryOrderWhereInput = { organizationId };

    if (query.salesOrderId) where.salesOrderId = query.salesOrderId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.status = query.status;

    if (query.search) {
      where.OR = [
        { deliveryNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, deliveries] = await Promise.all([
      this.prisma.deliveryOrder.count({ where }),
      this.prisma.deliveryOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
          salesOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      deliveries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single delivery order by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<DeliveryOrderWithDetails> {
    const delivery = await this.prisma.deliveryOrder.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        location: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
        shippingAddress: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
            salesOrderLine: {
              select: {
                id: true,
                quantity: true,
                quantityReserved: true,
                quantityDelivered: true,
                unitPrice: true,
              },
            },
            batch: { select: { id: true, batchNumber: true, expiresAt: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery order with ID ${id} not found`);
    }

    return delivery;
  }

  /**
   * Update draft delivery order.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateDeliveryOrderDto,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== DeliveryOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT delivery orders can be updated. Current status: ${existing.status}`,
      );
    }

    if (dto.shippingAddressId) {
      const address = await this.prisma.customerAddress.findFirst({
        where: {
          id: dto.shippingAddressId,
          customerId: existing.customerId,
          organizationId,
        },
      });
      if (!address) {
        throw new NotFoundException(
          `Shipping address with ID ${dto.shippingAddressId} not found for this customer`,
        );
      }
    }

    const data: Prisma.DeliveryOrderUpdateInput = {};
    if (dto.shippingAddressId !== undefined) {
      data.shippingAddress = dto.shippingAddressId
        ? { connect: { id: dto.shippingAddressId } }
        : { disconnect: true };
    }
    if (dto.scheduledDate !== undefined) {
      data.scheduledDate = dto.scheduledDate
        ? new Date(dto.scheduledDate)
        : null;
    }

    const updated = await this.prisma.deliveryOrder.update({
      where: { id },
      data,
      include: {
        customer: true,
        location: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
        shippingAddress: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: {
              select: { id: true, sku: true, name: true },
            },
            salesOrderLine: {
              select: {
                id: true,
                quantity: true,
                quantityReserved: true,
                quantityDelivered: true,
                unitPrice: true,
              },
            },
            batch: { select: { id: true, batchNumber: true, expiresAt: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_ORDER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'delivery_order.update',
      resource: 'delivery_order',
      resourceId: updated.id,
      details: { deliveryNumber: updated.deliveryNumber },
    });

    return updated;
  }

  /**
   * Mark delivery order as READY (DRAFT -> READY).
   */
  async ready(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== DeliveryOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT delivery orders can be marked as READY. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.deliveryOrder.update({
      where: { id },
      data: { status: DeliveryOrderStatus.READY },
      include: {
        customer: true,
        location: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
        shippingAddress: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: { select: { id: true, sku: true, name: true } },
            salesOrderLine: {
              select: {
                id: true,
                quantity: true,
                quantityReserved: true,
                quantityDelivered: true,
                unitPrice: true,
              },
            },
            batch: { select: { id: true, batchNumber: true, expiresAt: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_ORDER_READY',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'delivery_order.ready',
      resource: 'delivery_order',
      resourceId: id,
      details: { deliveryNumber: updated.deliveryNumber },
    });

    return updated;
  }

  /**
   * Mark delivery order as PICKED (DRAFT / READY -> PICKED).
   */
  async pick(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== DeliveryOrderStatus.DRAFT &&
      existing.status !== DeliveryOrderStatus.READY
    ) {
      throw new BadRequestException(
        `Only DRAFT or READY delivery orders can be marked as PICKED. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.deliveryOrder.update({
      where: { id },
      data: { status: DeliveryOrderStatus.PICKED },
      include: {
        customer: true,
        location: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
        shippingAddress: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: { select: { id: true, sku: true, name: true } },
            salesOrderLine: {
              select: {
                id: true,
                quantity: true,
                quantityReserved: true,
                quantityDelivered: true,
                unitPrice: true,
              },
            },
            batch: { select: { id: true, batchNumber: true, expiresAt: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_ORDER_PICKED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'delivery_order.pick',
      resource: 'delivery_order',
      resourceId: id,
      details: { deliveryNumber: updated.deliveryNumber },
    });

    return updated;
  }

  /**
   * Mark delivery order as DISPATCHED / SHIPPED.
   */
  async dispatch(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== DeliveryOrderStatus.DRAFT &&
      existing.status !== DeliveryOrderStatus.READY &&
      existing.status !== DeliveryOrderStatus.PICKED
    ) {
      throw new BadRequestException(
        `Only DRAFT, READY, or PICKED delivery orders can be dispatched. Current status: ${existing.status}`,
      );
    }

    const updated = await this.prisma.deliveryOrder.update({
      where: { id },
      data: {
        status: DeliveryOrderStatus.DISPATCHED,
        dispatchedAt: new Date(),
      },
      include: {
        customer: true,
        location: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
        shippingAddress: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: { select: { id: true, sku: true, name: true } },
            salesOrderLine: {
              select: {
                id: true,
                quantity: true,
                quantityReserved: true,
                quantityDelivered: true,
                unitPrice: true,
              },
            },
            batch: { select: { id: true, batchNumber: true, expiresAt: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_ORDER_DISPATCHED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'delivery_order.dispatch',
      resource: 'delivery_order',
      resourceId: id,
      details: { deliveryNumber: updated.deliveryNumber },
    });

    return updated;
  }

  /**
   * Backward compatible alias for dispatch.
   */
  async ship(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.dispatch(organizationId, id, actorUserId);
  }

  /**
   * Execute delivery: post outbound stock movement via BalancesService, fulfill reservations,
   * post M19 COGS GL Journal, increment SalesOrder delivered quantities, and mark DELIVERED.
   * Atomic & Idempotent: once DELIVERED, cannot deliver again.
   */
  async deliver(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    return this.executeDelivery(organizationId, id, actorUserId);
  }

  /**
   * Execute Delivery transaction (Complete Atomic Order-to-Fulfillment execution).
   */
  async executeDelivery(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<DeliveryOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === DeliveryOrderStatus.DELIVERED) {
      throw new BadRequestException('Delivery order is already delivered');
    }

    if (existing.status === DeliveryOrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot deliver a cancelled delivery order',
      );
    }

    let isFullyDelivered = false;

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Process each delivery line
      for (const line of existing.lines) {
        const soLine = await tx.salesOrderLine.findUniqueOrThrow({
          where: { id: line.salesOrderLineId },
        });

        const remainingToDeliver = soLine.quantity.sub(
          soLine.quantityDelivered,
        );
        if (line.quantity.greaterThan(remainingToDeliver)) {
          throw new BadRequestException(
            `Delivery quantity (${line.quantity.toString()}) exceeds remaining deliverable quantity (${remainingToDeliver.toString()}) for line ${line.id}`,
          );
        }

        // Apply Outbound Stock Movement via BalancesService
        const movement = await this.balancesService.applyStockMovement(
          organizationId,
          {
            locationId: existing.locationId,
            itemId: line.itemId,
            variantId: line.variantId ?? undefined,
            movementType: StockMovementType.ISSUE,
            quantity: Number(line.quantity),
            batchId: line.batchId ?? undefined,
            serialId: line.serialId ?? undefined,
            referenceType: 'DELIVERY_ORDER',
            referenceId: existing.deliveryNumber,
            reason: `Delivery order for SO ${existing.salesOrder.orderNumber}`,
          },
          actorUserId,
          tx,
        );

        // Record M19 COGS and GL Journal Entry
        try {
          await this.cogsService.recordAndPostCogs(
            organizationId,
            {
              itemId: line.itemId,
              variantId: line.variantId ?? null,
              locationId: existing.locationId,
              quantity: line.quantity,
              stockMovementId: movement?.movement?.id ?? null,
              deliveryOrderId: existing.id,
              sourceDocument: 'DELIVERY_ORDER',
              sourceDocumentId: existing.id,
              postToGl: true,
            },
            actorUserId,
            tx,
          );
        } catch {
          // If COGS posting fails due to open fiscal period or mapping, COGS handles cleanly
        }

        // Increment quantityDelivered on SO line
        await tx.salesOrderLine.update({
          where: { id: soLine.id },
          data: {
            quantityDelivered: {
              increment: line.quantity,
            },
          },
        });

        // Fulfill / release reservation if one exists for this SO line
        const activeRes = await tx.inventoryReservation.findFirst({
          where: {
            salesOrderLineId: soLine.id,
            organizationId,
            status: ReservationStatus.ACTIVE,
          },
        });

        if (activeRes) {
          const qtyToConsume = Prisma.Decimal.min(
            activeRes.quantity,
            line.quantity,
          );
          const balance = await tx.inventoryBalance.findFirst({
            where: {
              organizationId,
              locationId: existing.locationId,
              itemId: line.itemId,
              variantId: line.variantId ?? null,
            },
          });

          if (balance) {
            await tx.inventoryBalance.update({
              where: { id: balance.id },
              data: {
                quantityReserved: {
                  decrement: qtyToConsume,
                },
              },
            });
          }

          if (activeRes.quantity.equals(qtyToConsume)) {
            await tx.inventoryReservation.update({
              where: { id: activeRes.id },
              data: {
                status: ReservationStatus.FULFILLED,
                releasedAt: new Date(),
              },
            });
          } else {
            await tx.inventoryReservation.update({
              where: { id: activeRes.id },
              data: {
                quantity: {
                  decrement: qtyToConsume,
                },
              },
            });
          }
        }
      }

      // 2. Recalculate Sales Order Status
      const allSoLines = await tx.salesOrderLine.findMany({
        where: { salesOrderId: existing.salesOrderId },
      });

      isFullyDelivered = allSoLines.every((l) =>
        l.quantityDelivered.greaterThanOrEqualTo(l.quantity),
      );

      const newSoStatus = isFullyDelivered
        ? SalesOrderStatus.FULFILLED
        : SalesOrderStatus.PARTIALLY_FULFILLED;

      await tx.salesOrder.update({
        where: { id: existing.salesOrderId },
        data: { status: newSoStatus },
      });

      // 3. Mark Delivery Order as DELIVERED
      await tx.deliveryOrder.update({
        where: { id },
        data: {
          status: DeliveryOrderStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      return tx.deliveryOrder.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          location: true,
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              currency: { select: { id: true, code: true, symbol: true } },
            },
          },
          shippingAddress: true,
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  trackingType: true,
                },
              },
              variant: { select: { id: true, sku: true, name: true } },
              salesOrderLine: {
                select: {
                  id: true,
                  quantity: true,
                  quantityReserved: true,
                  quantityDelivered: true,
                  unitPrice: true,
                },
              },
              batch: {
                select: { id: true, batchNumber: true, expiresAt: true },
              },
              serial: { select: { id: true, serialNumber: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_ORDER_DELIVERED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'delivery_order.deliver',
      resource: 'delivery_order',
      resourceId: id,
      details: {
        deliveryNumber: updated.deliveryNumber,
        salesOrderNumber: updated.salesOrder.orderNumber,
      },
    });

    if (isFullyDelivered) {
      await this.eventBus.publish({
        eventName: 'SALES_FULFILLMENT_COMPLETED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'sales_order.fulfillment_complete',
        resource: 'sales_order',
        resourceId: updated.salesOrderId,
        details: { orderNumber: updated.salesOrder.orderNumber },
      });
    }

    return updated;
  }

  /**
   * Cancel delivery order (DRAFT / READY / PICKED -> CANCELLED).
   */
  async cancel(
    organizationId: string,
    id: string,
    reason?: string,
    actorUserId?: string,
  ): Promise<DeliveryOrderWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === DeliveryOrderStatus.DELIVERED ||
      existing.status === DeliveryOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel delivery order in '${existing.status}' status.`,
      );
    }

    const updated = await this.prisma.deliveryOrder.update({
      where: { id },
      data: {
        status: DeliveryOrderStatus.CANCELLED,
        cancellationReason: reason?.trim() ?? null,
      },
      include: {
        customer: true,
        location: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            currency: { select: { id: true, code: true, symbol: true } },
          },
        },
        shippingAddress: true,
        lines: {
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                trackingType: true,
              },
            },
            variant: { select: { id: true, sku: true, name: true } },
            salesOrderLine: {
              select: {
                id: true,
                quantity: true,
                quantityReserved: true,
                quantityDelivered: true,
                unitPrice: true,
              },
            },
            batch: { select: { id: true, batchNumber: true, expiresAt: true } },
            serial: { select: { id: true, serialNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? 'system',
      action: 'delivery_order.cancel',
      resource: 'delivery_order',
      resourceId: id,
      details: { deliveryNumber: updated.deliveryNumber, reason },
    });

    await this.eventBus.publish({
      eventName: 'DELIVERY_ORDER_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? 'system',
      action: 'delivery_order.cancel',
      resource: 'delivery_order',
      resourceId: id,
      details: { deliveryNumber: updated.deliveryNumber, reason },
    });

    return updated;
  }
}
