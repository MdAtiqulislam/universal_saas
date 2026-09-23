import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { AssignCarrierDto } from './dto/assign-carrier.dto';
import { AssignVehicleDto } from './dto/assign-vehicle.dto';
import { DispatchShipmentDto } from './dto/dispatch-shipment.dto';
import { FailShipmentDto } from './dto/fail-shipment.dto';
import { ReturnShipmentDto } from './dto/return-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import {
  Shipment,
  ShipmentStatus,
  ShipmentTrackingEventType,
  DeliveryOrderStatus,
  Prisma,
} from '@prisma/client';

export type ShipmentWithDetails = Prisma.ShipmentGetPayload<{
  include: {
    deliveryOrder: {
      include: {
        customer: true;
        salesOrder: true;
      };
    };
    salesOrder: true;
    customer: true;
    carrier: true;
    vehicle: true;
    lines: {
      include: {
        item: true;
        variant: true;
        deliveryOrderLine: true;
      };
    };
    packages: true;
    trackingEvents: true;
  };
}>;

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create a new shipment from an eligible Delivery Order.
   */
  async create(
    organizationId: string,
    dto: CreateShipmentDto,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate Delivery Order
      const deliveryOrder = await tx.deliveryOrder.findFirst({
        where: {
          id: dto.deliveryOrderId,
          organizationId,
        },
        include: {
          lines: {
            include: {
              item: true,
              variant: true,
            },
          },
          salesOrder: true,
          customer: true,
        },
      });

      if (!deliveryOrder) {
        throw new NotFoundException(
          `Delivery Order with ID ${dto.deliveryOrderId} not found in this organization`,
        );
      }

      if (deliveryOrder.status === DeliveryOrderStatus.CANCELLED) {
        throw new BadRequestException(
          'Cannot create a shipment for a cancelled delivery order',
        );
      }

      // 2. Validate Carrier if provided
      if (dto.carrierId) {
        const carrier = await tx.shipmentCarrier.findFirst({
          where: {
            id: dto.carrierId,
            organizationId,
          },
        });
        if (!carrier) {
          throw new NotFoundException(
            `Carrier with ID ${dto.carrierId} not found in this organization`,
          );
        }
        if (!carrier.isActive) {
          throw new BadRequestException(
            `Carrier '${carrier.name}' is inactive and cannot be assigned`,
          );
        }
      }

      // 3. Validate Vehicle if provided
      if (dto.vehicleId) {
        const vehicle = await tx.shipmentVehicle.findFirst({
          where: {
            id: dto.vehicleId,
            organizationId,
          },
        });
        if (!vehicle) {
          throw new NotFoundException(
            `Vehicle with ID ${dto.vehicleId} not found in this organization`,
          );
        }
        if (!vehicle.isActive) {
          throw new BadRequestException(
            `Vehicle '${vehicle.registrationNumber}' is inactive`,
          );
        }
      }

      // 4. Validate and build Shipment Lines
      const existingShipmentLines = await tx.shipmentLine.findMany({
        where: {
          organizationId,
          shipment: {
            deliveryOrderId: dto.deliveryOrderId,
            status: { not: ShipmentStatus.CANCELLED },
          },
        },
      });

      // Map shipped quantity per deliveryOrderLineId
      const shippedQtyByLine = new Map<string, Prisma.Decimal>();
      for (const line of existingShipmentLines) {
        const current =
          shippedQtyByLine.get(line.deliveryOrderLineId) ||
          new Prisma.Decimal(0);
        shippedQtyByLine.set(
          line.deliveryOrderLineId,
          current.plus(line.quantity),
        );
      }

      const linesToCreate: Array<{
        deliveryOrderLineId: string;
        salesOrderLineId: string;
        itemId: string;
        variantId: string | null;
        quantity: Prisma.Decimal;
        unitOfMeasure: string | null;
        packageReference: string | null;
        batchReference: string | null;
        serialReference: string | null;
      }> = [];

      if (dto.lines && dto.lines.length > 0) {
        for (const inputLine of dto.lines) {
          const doLine = deliveryOrder.lines.find(
            (l) => l.id === inputLine.deliveryOrderLineId,
          );
          if (!doLine) {
            throw new BadRequestException(
              `Delivery order line ID ${inputLine.deliveryOrderLineId} not found on delivery order ${deliveryOrder.deliveryNumber}`,
            );
          }

          const requestedQty = new Prisma.Decimal(inputLine.quantity);
          if (requestedQty.lte(0)) {
            throw new BadRequestException(
              'Shipment line quantity must be strictly positive',
            );
          }

          const alreadyShipped =
            shippedQtyByLine.get(doLine.id) || new Prisma.Decimal(0);
          const availableToShip = doLine.quantity.minus(alreadyShipped);

          if (requestedQty.gt(availableToShip)) {
            throw new BadRequestException(
              `Requested quantity ${requestedQty.toString()} exceeds eligible unshipped quantity ${availableToShip.toString()} for item ${doLine.itemId}`,
            );
          }

          shippedQtyByLine.set(doLine.id, alreadyShipped.plus(requestedQty));

          linesToCreate.push({
            deliveryOrderLineId: doLine.id,
            salesOrderLineId: doLine.salesOrderLineId,
            itemId: doLine.itemId,
            variantId: doLine.variantId,
            quantity: requestedQty,
            unitOfMeasure: null,
            packageReference: inputLine.packageReference ?? null,
            batchReference: inputLine.batchReference ?? null,
            serialReference: inputLine.serialReference ?? null,
          });
        }
      } else {
        // Auto-create from all eligible delivery order lines
        for (const doLine of deliveryOrder.lines) {
          const alreadyShipped =
            shippedQtyByLine.get(doLine.id) || new Prisma.Decimal(0);
          const availableToShip = doLine.quantity.minus(alreadyShipped);

          if (availableToShip.gt(0)) {
            linesToCreate.push({
              deliveryOrderLineId: doLine.id,
              salesOrderLineId: doLine.salesOrderLineId,
              itemId: doLine.itemId,
              variantId: doLine.variantId,
              quantity: availableToShip,
              unitOfMeasure: null,
              packageReference: null,
              batchReference: null,
              serialReference: null,
            });
          }
        }
      }

      if (linesToCreate.length === 0) {
        throw new BadRequestException(
          'No eligible unshipped quantities remain on this delivery order to create a shipment',
        );
      }

      // 5. Generate Shipment Number
      let shipmentNumber: string;
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'SHIPMENT',
          actorUserId,
        );
        shipmentNumber = seq.formatted;
      } catch {
        const count = await tx.shipment.count({
          where: { organizationId },
        });
        shipmentNumber = `SHP-${String(count + 1).padStart(6, '0')}`;
      }

      // 6. Calculate logistics costs
      const shippingCost = new Prisma.Decimal(dto.shippingCost ?? 0);
      const insuranceCost = new Prisma.Decimal(dto.insuranceCost ?? 0);
      const otherCost = new Prisma.Decimal(dto.otherCost ?? 0);
      const totalLogisticsCost = shippingCost
        .plus(insuranceCost)
        .plus(otherCost);

      // 7. Create Shipment & Lines
      const shipment = await tx.shipment.create({
        data: {
          organizationId,
          shipmentNumber,
          deliveryOrderId: deliveryOrder.id,
          salesOrderId: deliveryOrder.salesOrderId,
          customerId: deliveryOrder.customerId,
          carrierId: dto.carrierId ?? null,
          vehicleId: dto.vehicleId ?? null,
          status: ShipmentStatus.DRAFT,
          serviceType: dto.serviceType?.trim() ?? null,
          shipFromAddress: dto.shipFromAddress?.trim() ?? null,
          shipToAddress: dto.shipToAddress?.trim() ?? null,
          plannedShipDate: dto.plannedShipDate
            ? new Date(dto.plannedShipDate)
            : null,
          estimatedDeliveryDate: dto.estimatedDeliveryDate
            ? new Date(dto.estimatedDeliveryDate)
            : null,
          trackingNumber: dto.trackingNumber?.trim() ?? null,
          externalReference: dto.externalReference?.trim() ?? null,
          shippingCost,
          insuranceCost,
          otherCost,
          totalLogisticsCost,
          specialInstructions: dto.specialInstructions?.trim() ?? null,
          createdByUserId:
            actorUserId || '00000000-0000-0000-0000-000000000000',
          lines: {
            create: linesToCreate.map((l) => ({
              organizationId,
              deliveryOrderLineId: l.deliveryOrderLineId,
              salesOrderLineId: l.salesOrderLineId,
              itemId: l.itemId,
              variantId: l.variantId,
              quantity: l.quantity,
              unitOfMeasure: l.unitOfMeasure,
              packageReference: l.packageReference,
              batchReference: l.batchReference,
              serialReference: l.serialReference,
            })),
          },
          trackingEvents: {
            create: {
              organizationId,
              status: ShipmentStatus.DRAFT,
              eventType: ShipmentTrackingEventType.CREATED,
              eventTime: new Date(),
              description: `Shipment ${shipmentNumber} created from Delivery Order ${deliveryOrder.deliveryNumber}`,
              source: 'SYSTEM',
              createdByUserId: actorUserId ?? null,
            },
          },
        },
        include: {
          deliveryOrder: {
            include: {
              customer: true,
              salesOrder: true,
            },
          },
          salesOrder: true,
          customer: true,
          carrier: true,
          vehicle: true,
          lines: {
            include: {
              item: true,
              variant: true,
              deliveryOrderLine: true,
            },
          },
          packages: true,
          trackingEvents: true,
        },
      });

      // 8. Publish Audit Event
      await this.eventBus.publish({
        eventName: 'SHIPMENT_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'shipment.create',
        resource: 'shipment',
        resourceId: shipment.id,
        details: {
          shipmentNumber: shipment.shipmentNumber,
          deliveryOrderId: shipment.deliveryOrderId,
          totalLogisticsCost: shipment.totalLogisticsCost.toString(),
          lineCount: shipment.lines.length,
        },
      });

      return shipment;
    });
  }

  /**
   * Find paginated shipments with filtering.
   */
  async findAll(
    organizationId: string,
    query: ShipmentQueryDto,
  ): Promise<{
    shipments: Shipment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ShipmentWhereInput = {
      organizationId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.deliveryOrderId) {
      where.deliveryOrderId = query.deliveryOrderId;
    }

    if (query.salesOrderId) {
      where.salesOrderId = query.salesOrderId;
    }

    if (query.carrierId) {
      where.carrierId = query.carrierId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { shipmentNumber: { contains: query.search, mode: 'insensitive' } },
        { trackingNumber: { contains: query.search, mode: 'insensitive' } },
        { externalReference: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          carrier: true,
          deliveryOrder: true,
          lines: true,
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      shipments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find a single shipment by ID with complete relationships.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ShipmentWithDetails> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        deliveryOrder: {
          include: {
            customer: true,
            salesOrder: true,
          },
        },
        salesOrder: true,
        customer: true,
        carrier: true,
        vehicle: true,
        lines: {
          include: {
            item: true,
            variant: true,
            deliveryOrderLine: true,
          },
        },
        packages: true,
        trackingEvents: {
          orderBy: { eventTime: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    return shipment;
  }

  /**
   * Update editable shipment metadata.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateShipmentDto,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === ShipmentStatus.CLOSED ||
      existing.status === ShipmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot edit shipment in ${existing.status} status`,
      );
    }

    let shippingCost = existing.shippingCost;
    let insuranceCost = existing.insuranceCost;
    let otherCost = existing.otherCost;

    if (dto.shippingCost !== undefined)
      shippingCost = new Prisma.Decimal(dto.shippingCost);
    if (dto.insuranceCost !== undefined)
      insuranceCost = new Prisma.Decimal(dto.insuranceCost);
    if (dto.otherCost !== undefined)
      otherCost = new Prisma.Decimal(dto.otherCost);
    const totalLogisticsCost = shippingCost.plus(insuranceCost).plus(otherCost);

    await this.prisma.shipment.update({
      where: { id },
      data: {
        carrierId: dto.carrierId !== undefined ? dto.carrierId : undefined,
        vehicleId: dto.vehicleId !== undefined ? dto.vehicleId : undefined,
        serviceType:
          dto.serviceType !== undefined
            ? (dto.serviceType?.trim() ?? null)
            : undefined,
        shipFromAddress:
          dto.shipFromAddress !== undefined
            ? (dto.shipFromAddress?.trim() ?? null)
            : undefined,
        shipToAddress:
          dto.shipToAddress !== undefined
            ? (dto.shipToAddress?.trim() ?? null)
            : undefined,
        plannedShipDate: dto.plannedShipDate
          ? new Date(dto.plannedShipDate)
          : undefined,
        estimatedDeliveryDate: dto.estimatedDeliveryDate
          ? new Date(dto.estimatedDeliveryDate)
          : undefined,
        trackingNumber:
          dto.trackingNumber !== undefined
            ? (dto.trackingNumber?.trim() ?? null)
            : undefined,
        externalReference:
          dto.externalReference !== undefined
            ? (dto.externalReference?.trim() ?? null)
            : undefined,
        shippingCost,
        insuranceCost,
        otherCost,
        totalLogisticsCost,
        specialInstructions:
          dto.specialInstructions !== undefined
            ? (dto.specialInstructions?.trim() ?? null)
            : undefined,
        updatedByUserId: actorUserId ?? null,
      },
    });

    await this.eventBus.publish({
      eventName: 'SHIPMENT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'shipment.update',
      resource: 'shipment',
      resourceId: id,
      details: { shipmentNumber: existing.shipmentNumber },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Mark shipment as READY for transport assignment.
   */
  async prepare(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== ShipmentStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT shipments can be prepared (current status: ${existing.status})`,
      );
    }

    if (existing.lines.length === 0) {
      throw new BadRequestException(
        'Cannot prepare shipment without line items',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.READY,
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: ShipmentStatus.READY,
          eventType: ShipmentTrackingEventType.READY,
          eventTime: new Date(),
          description:
            'Shipment prepared and marked ready for transport assignment',
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SHIPMENT_READY',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'shipment.ready',
      resource: 'shipment',
      resourceId: id,
      details: { shipmentNumber: existing.shipmentNumber },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Assign carrier to shipment.
   */
  async assignCarrier(
    organizationId: string,
    id: string,
    dto: AssignCarrierDto,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === ShipmentStatus.DISPATCHED ||
      existing.status === ShipmentStatus.IN_TRANSIT ||
      existing.status === ShipmentStatus.DELIVERED ||
      existing.status === ShipmentStatus.CLOSED ||
      existing.status === ShipmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot assign carrier to shipment in ${existing.status} status`,
      );
    }

    const carrier = await this.prisma.shipmentCarrier.findFirst({
      where: {
        id: dto.carrierId,
        organizationId,
      },
    });

    if (!carrier) {
      throw new NotFoundException(`Carrier with ID ${dto.carrierId} not found`);
    }

    if (!carrier.isActive) {
      throw new BadRequestException(`Carrier '${carrier.name}' is inactive`);
    }

    await this.prisma.$transaction(async (tx) => {
      const nextStatus =
        existing.status === ShipmentStatus.READY ||
        existing.status === ShipmentStatus.DRAFT
          ? ShipmentStatus.ASSIGNED
          : existing.status;

      await tx.shipment.update({
        where: { id },
        data: {
          carrierId: carrier.id,
          trackingNumber: dto.trackingNumber?.trim() || existing.trackingNumber,
          serviceType: dto.serviceType?.trim() || existing.serviceType,
          status: nextStatus,
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: nextStatus,
          eventType: ShipmentTrackingEventType.ASSIGNED,
          eventTime: new Date(),
          description: `Assigned carrier: ${carrier.name} (${carrier.code})`,
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SHIPMENT_CARRIER_ASSIGNED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'shipment.assign_carrier',
      resource: 'shipment',
      resourceId: id,
      details: {
        shipmentNumber: existing.shipmentNumber,
        carrierId: carrier.id,
        carrierCode: carrier.code,
      },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Assign vehicle to shipment.
   */
  async assignVehicle(
    organizationId: string,
    id: string,
    dto: AssignVehicleDto,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === ShipmentStatus.CLOSED ||
      existing.status === ShipmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot assign vehicle to shipment in ${existing.status} status`,
      );
    }

    const vehicle = await this.prisma.shipmentVehicle.findFirst({
      where: {
        id: dto.vehicleId,
        organizationId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${dto.vehicleId} not found`);
    }

    if (!vehicle.isActive) {
      throw new BadRequestException(
        `Vehicle '${vehicle.registrationNumber}' is inactive`,
      );
    }

    await this.prisma.shipment.update({
      where: { id },
      data: {
        vehicleId: vehicle.id,
        updatedByUserId: actorUserId ?? null,
      },
    });

    await this.eventBus.publish({
      eventName: 'SHIPMENT_VEHICLE_ASSIGNED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'shipment.assign_vehicle',
      resource: 'shipment',
      resourceId: id,
      details: {
        shipmentNumber: existing.shipmentNumber,
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
      },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Dispatch shipment into logistics transit.
   */
  async dispatch(
    organizationId: string,
    id: string,
    dto: DispatchShipmentDto = {},
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findFirst({
        where: { id, organizationId },
        include: { lines: true, carrier: true },
      });

      if (!existing) {
        throw new NotFoundException(`Shipment with ID ${id} not found`);
      }

      if (
        existing.status === ShipmentStatus.DISPATCHED ||
        existing.status === ShipmentStatus.IN_TRANSIT ||
        existing.status === ShipmentStatus.DELIVERED
      ) {
        throw new BadRequestException(
          `Shipment is already dispatched or in a later status (${existing.status})`,
        );
      }

      if (
        existing.status === ShipmentStatus.CANCELLED ||
        existing.status === ShipmentStatus.CLOSED ||
        existing.status === ShipmentStatus.FAILED ||
        existing.status === ShipmentStatus.RETURNED
      ) {
        throw new BadRequestException(
          `Cannot dispatch shipment in ${existing.status} status`,
        );
      }

      if (existing.lines.length === 0) {
        throw new BadRequestException('Cannot dispatch shipment with no lines');
      }

      const actualShipDate = dto.actualShipDate
        ? new Date(dto.actualShipDate)
        : new Date();

      const trackingNumber =
        dto.trackingNumber?.trim() || existing.trackingNumber;

      const updated = await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.DISPATCHED,
          actualShipDate,
          trackingNumber,
          dispatchedByUserId: actorUserId ?? null,
          dispatchedAt: new Date(),
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: ShipmentStatus.DISPATCHED,
          eventType: ShipmentTrackingEventType.DISPATCHED,
          eventTime: actualShipDate,
          description:
            dto.notes?.trim() ||
            `Shipment ${existing.shipmentNumber} dispatched for transit`,
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });

      await this.eventBus.publish({
        eventName: 'SHIPMENT_DISPATCHED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'shipment.dispatch',
        resource: 'shipment',
        resourceId: id,
        details: {
          shipmentNumber: updated.shipmentNumber,
          actualShipDate: actualShipDate.toISOString(),
          trackingNumber: updated.trackingNumber,
        },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Mark shipment IN_TRANSIT.
   */
  async markInTransit(
    organizationId: string,
    id: string,
    notes?: string,
    location?: string,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findFirst({
        where: { id, organizationId },
      });

      if (!existing) {
        throw new NotFoundException(`Shipment with ID ${id} not found`);
      }

      if (existing.status !== ShipmentStatus.DISPATCHED) {
        throw new BadRequestException(
          `Shipment must be in DISPATCHED status to mark IN_TRANSIT (current: ${existing.status})`,
        );
      }

      await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.IN_TRANSIT,
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: ShipmentStatus.IN_TRANSIT,
          eventType: ShipmentTrackingEventType.IN_TRANSIT,
          eventTime: new Date(),
          location: location?.trim() ?? null,
          description:
            notes?.trim() ||
            `Shipment ${existing.shipmentNumber} is in transit`,
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });

      await this.eventBus.publish({
        eventName: 'SHIPMENT_IN_TRANSIT',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'shipment.in_transit',
        resource: 'shipment',
        resourceId: id,
        details: { shipmentNumber: existing.shipmentNumber },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Confirm customer delivery of shipment.
   */
  async markDelivered(
    organizationId: string,
    id: string,
    notes?: string,
    location?: string,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findFirst({
        where: { id, organizationId },
      });

      if (!existing) {
        throw new NotFoundException(`Shipment with ID ${id} not found`);
      }

      if (existing.status === ShipmentStatus.DELIVERED) {
        throw new BadRequestException('Shipment has already been delivered');
      }

      if (
        existing.status !== ShipmentStatus.DISPATCHED &&
        existing.status !== ShipmentStatus.IN_TRANSIT
      ) {
        throw new BadRequestException(
          `Shipment must be DISPATCHED or IN_TRANSIT to confirm delivery (current: ${existing.status})`,
        );
      }

      const actualDeliveryDate = new Date();

      await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.DELIVERED,
          actualDeliveryDate,
          deliveredByUserId: actorUserId ?? null,
          deliveredAt: actualDeliveryDate,
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: ShipmentStatus.DELIVERED,
          eventType: ShipmentTrackingEventType.DELIVERED,
          eventTime: actualDeliveryDate,
          location: location?.trim() ?? null,
          description:
            notes?.trim() ||
            `Shipment ${existing.shipmentNumber} successfully delivered to customer`,
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });

      await this.eventBus.publish({
        eventName: 'SHIPMENT_DELIVERED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'shipment.deliver',
        resource: 'shipment',
        resourceId: id,
        details: {
          shipmentNumber: existing.shipmentNumber,
          actualDeliveryDate: actualDeliveryDate.toISOString(),
        },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Record a failed delivery attempt.
   */
  async markFailed(
    organizationId: string,
    id: string,
    dto: FailShipmentDto,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findFirst({
        where: { id, organizationId },
      });

      if (!existing) {
        throw new NotFoundException(`Shipment with ID ${id} not found`);
      }

      if (
        existing.status !== ShipmentStatus.DISPATCHED &&
        existing.status !== ShipmentStatus.IN_TRANSIT
      ) {
        throw new BadRequestException(
          `Only DISPATCHED or IN_TRANSIT shipments can fail delivery (current: ${existing.status})`,
        );
      }

      await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.FAILED,
          failureReason: dto.failureReason.trim(),
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: ShipmentStatus.FAILED,
          eventType: ShipmentTrackingEventType.DELIVERY_ATTEMPT_FAILED,
          eventTime: new Date(),
          location: dto.location?.trim() ?? null,
          description: `Delivery attempt failed: ${dto.failureReason.trim()}`,
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });

      await this.eventBus.publish({
        eventName: 'SHIPMENT_FAILED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'shipment.fail',
        resource: 'shipment',
        resourceId: id,
        details: {
          shipmentNumber: existing.shipmentNumber,
          failureReason: dto.failureReason.trim(),
        },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Process a returned shipment.
   */
  async initiateReturn(
    organizationId: string,
    id: string,
    dto: ReturnShipmentDto,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findFirst({
        where: { id, organizationId },
      });

      if (!existing) {
        throw new NotFoundException(`Shipment with ID ${id} not found`);
      }

      if (existing.status === ShipmentStatus.RETURNED) {
        throw new BadRequestException(
          'Shipment return has already been processed',
        );
      }

      if (
        existing.status !== ShipmentStatus.FAILED &&
        existing.status !== ShipmentStatus.IN_TRANSIT &&
        existing.status !== ShipmentStatus.DISPATCHED
      ) {
        throw new BadRequestException(
          `Cannot initiate return for shipment in ${existing.status} status`,
        );
      }

      await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.RETURNED,
          returnReason: dto.returnReason.trim(),
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: ShipmentStatus.RETURNED,
          eventType: ShipmentTrackingEventType.RETURNED,
          eventTime: new Date(),
          location: dto.location?.trim() ?? null,
          description: `Shipment returned: ${dto.returnReason.trim()}`,
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });

      await this.eventBus.publish({
        eventName: 'SHIPMENT_RETURNED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: actorUserId ?? null,
        action: 'shipment.return',
        resource: 'shipment',
        resourceId: id,
        details: {
          shipmentNumber: existing.shipmentNumber,
          returnReason: dto.returnReason.trim(),
        },
      });

      return this.findOne(organizationId, id);
    });
  }

  /**
   * Close a completed or returned shipment.
   */
  async close(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status !== ShipmentStatus.DELIVERED &&
      existing.status !== ShipmentStatus.RETURNED &&
      existing.status !== ShipmentStatus.FAILED
    ) {
      throw new BadRequestException(
        `Only DELIVERED, RETURNED, or FAILED shipments can be closed (current: ${existing.status})`,
      );
    }

    await this.prisma.shipment.update({
      where: { id },
      data: {
        status: ShipmentStatus.CLOSED,
        updatedByUserId: actorUserId ?? null,
      },
    });

    await this.eventBus.publish({
      eventName: 'SHIPMENT_CLOSED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'shipment.close',
      resource: 'shipment',
      resourceId: id,
      details: { shipmentNumber: existing.shipmentNumber },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Cancel a draft, ready, or assigned shipment.
   */
  async cancel(
    organizationId: string,
    id: string,
    dto: CancelShipmentDto,
    actorUserId?: string,
  ): Promise<ShipmentWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === ShipmentStatus.DISPATCHED ||
      existing.status === ShipmentStatus.IN_TRANSIT ||
      existing.status === ShipmentStatus.DELIVERED ||
      existing.status === ShipmentStatus.CLOSED
    ) {
      throw new BadRequestException(
        `Cannot cancel shipment in ${existing.status} status`,
      );
    }

    if (existing.status === ShipmentStatus.CANCELLED) {
      return existing;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.CANCELLED,
          cancellationReason: dto.cancellationReason.trim(),
          cancelledByUserId: actorUserId ?? null,
          cancelledAt: new Date(),
          updatedByUserId: actorUserId ?? null,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          organizationId,
          shipmentId: id,
          status: ShipmentStatus.CANCELLED,
          eventType: ShipmentTrackingEventType.CANCELLED,
          eventTime: new Date(),
          description: `Shipment cancelled: ${dto.cancellationReason.trim()}`,
          source: 'SYSTEM',
          createdByUserId: actorUserId ?? null,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'SHIPMENT_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'shipment.cancel',
      resource: 'shipment',
      resourceId: id,
      details: {
        shipmentNumber: existing.shipmentNumber,
        cancellationReason: dto.cancellationReason.trim(),
      },
    });

    return this.findOne(organizationId, id);
  }
}
