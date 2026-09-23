import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';
import {
  ProductionOrderStatus,
  ProductionLineStatus,
  Prisma,
} from '@prisma/client';

export interface ComponentAvailabilityResult {
  itemId: string;
  variantId?: string | null;
  sku: string;
  name: string;
  requiredQuantity: number;
  availableQuantity: number;
  shortageQuantity: number;
  isSufficient: boolean;
}

export interface MaterialAvailabilityReport {
  productionOrderId: string;
  orderNumber: string;
  isAllAvailable: boolean;
  components: ComponentAvailabilityResult[];
}

@Injectable()
export class ProductionOrdersService {
  private readonly logger = new Logger(ProductionOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly configService: ManufacturingConfigService,
  ) {}

  /**
   * Create a new Production Order in DRAFT status.
   */
  async create(
    organizationId: string,
    dto: CreateProductionOrderDto,
    userId: string,
  ) {
    if (dto.plannedQuantity <= 0) {
      throw new BadRequestException(
        'Planned quantity must be strictly positive.',
      );
    }

    const startDate = new Date(dto.plannedStartDate);
    const completionDate = new Date(dto.plannedCompletionDate);
    if (startDate > completionDate) {
      throw new BadRequestException(
        'Planned start date cannot be later than planned completion date.',
      );
    }

    // Verify finished item
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item with ID ${dto.itemId} not found.`);
    }

    // Verify location
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId },
    });
    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found.`,
      );
    }

    // Verify BOM
    const bom = await this.prisma.billOfMaterial.findFirst({
      where: { id: dto.bomId, organizationId },
      include: { lines: { include: { item: true, uom: true } } },
    });
    if (!bom) {
      throw new NotFoundException(`BOM with ID ${dto.bomId} not found.`);
    }
    if (bom.itemId !== dto.itemId) {
      throw new BadRequestException(
        'The specified BOM does not produce the specified finished item.',
      );
    }
    if (bom.lines.length === 0) {
      throw new BadRequestException(
        'The specified BOM has no component lines.',
      );
    }

    // Order number generation
    let orderNumber = dto.orderNumber;
    if (!orderNumber) {
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'PRODUCTION_ORDER',
          userId,
        );
        orderNumber = seq.formatted;
      } catch {
        const count = await this.prisma.productionOrder.count({
          where: { organizationId },
        });
        orderNumber = `MO-${String(count + 1).padStart(6, '0')}`;
      }
    } else {
      const duplicate = await this.prisma.productionOrder.findUnique({
        where: {
          organizationId_orderNumber: {
            organizationId,
            orderNumber,
          },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Production order with number ${orderNumber} already exists.`,
        );
      }
    }

    const plannedQty = new Prisma.Decimal(dto.plannedQuantity);
    const bomQty = bom.quantity.isZero() ? new Prisma.Decimal(1) : bom.quantity;

    // Create production order & lines atomically
    const order = await this.prisma.$transaction(async (tx) => {
      return tx.productionOrder.create({
        data: {
          organizationId,
          orderNumber: orderNumber,
          itemId: dto.itemId,
          variantId: dto.variantId ?? null,
          bomId: dto.bomId,
          plannedQuantity: plannedQty,
          producedQuantity: new Prisma.Decimal(0),
          scrapQuantity: new Prisma.Decimal(0),
          locationId: dto.locationId,
          status: ProductionOrderStatus.DRAFT,
          plannedStartDate: startDate,
          plannedCompletionDate: completionDate,
          sourceDocument: dto.sourceDocument,
          sourceDocumentId: dto.sourceDocumentId,
          notes: dto.notes,
          createdByUserId: userId,
          lines: {
            create: bom.lines.map((bLine) => {
              // required = (bLine.quantity * plannedQty / bomQty) * (1 + scrap / 100)
              const scrapMultiplier = new Prisma.Decimal(1).plus(
                bLine.scrapPercentage.div(100),
              );
              const requiredQty = bLine.quantity
                .mul(plannedQty)
                .div(bomQty)
                .mul(scrapMultiplier);

              return {
                organizationId,
                itemId: bLine.itemId,
                variantId: bLine.variantId ?? null,
                requiredQuantity: requiredQty,
                issuedQuantity: new Prisma.Decimal(0),
                returnedQuantity: new Prisma.Decimal(0),
                consumedQuantity: new Prisma.Decimal(0),
                scrapQuantity: new Prisma.Decimal(0),
                uomId: bLine.uomId,
                status: ProductionLineStatus.PENDING,
              };
            }),
          },
        },
        include: {
          item: true,
          location: true,
          bom: true,
          lines: {
            include: { item: true, uom: true },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'PRODUCTION_ORDER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'manufacturing.order.create',
      resource: 'production_order',
      resourceId: order.id,
      details: {
        orderNumber: order.orderNumber,
        itemId: order.itemId,
        plannedQuantity: Number(order.plannedQuantity),
        lineCount: order.lines.length,
      },
    });

    return order;
  }

  /**
   * Find all production orders with filtering and pagination.
   */
  async findAll(organizationId: string, query: ProductionOrderQueryDto) {
    const where: Prisma.ProductionOrderWhereInput = { organizationId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.itemId) {
      where.itemId = query.itemId;
    }
    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.startDate) {
      where.plannedStartDate = { gte: new Date(query.startDate) };
    }
    if (query.endDate) {
      where.plannedCompletionDate = { lte: new Date(query.endDate) };
    }
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        include: {
          item: true,
          location: true,
          bom: true,
          lines: {
            include: { item: true, uom: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productionOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single production order by ID.
   */
  async findOne(organizationId: string, id: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, organizationId },
      include: {
        item: true,
        variant: true,
        location: true,
        bom: {
          include: { lines: true },
        },
        lines: {
          include: { item: true, variant: true, uom: true },
        },
        materialIssues: {
          include: { item: true, batch: true, serial: true },
        },
        outputs: {
          include: { item: true, batch: true, serial: true },
        },
        issueJournalEntry: true,
        completionJournalEntry: true,
        varianceJournalEntry: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Production order with ID ${id} not found.`);
    }

    return order;
  }

  /**
   * Update production order (allowed in DRAFT only).
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateProductionOrderDto,
    userId: string,
  ) {
    const order = await this.findOne(organizationId, id);

    if (order.status !== ProductionOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot update production order in status ${order.status}. Only DRAFT orders can be edited.`,
      );
    }

    const updated = await this.prisma.productionOrder.update({
      where: { id },
      data: {
        plannedQuantity: dto.plannedQuantity
          ? new Prisma.Decimal(dto.plannedQuantity)
          : undefined,
        locationId: dto.locationId,
        plannedStartDate: dto.plannedStartDate
          ? new Date(dto.plannedStartDate)
          : undefined,
        plannedCompletionDate: dto.plannedCompletionDate
          ? new Date(dto.plannedCompletionDate)
          : undefined,
        notes: dto.notes,
      },
      include: {
        item: true,
        location: true,
        bom: true,
        lines: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'PRODUCTION_ORDER_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'manufacturing.order.update',
      resource: 'production_order',
      resourceId: id,
    });

    return updated;
  }

  /**
   * Delete draft production order.
   */
  async delete(organizationId: string, id: string) {
    const order = await this.findOne(organizationId, id);

    if (order.status !== ProductionOrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot delete production order in status ${order.status}. Only DRAFT orders can be deleted.`,
      );
    }

    await this.prisma.productionOrder.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Check material availability for a production order.
   */
  async checkMaterialAvailability(
    organizationId: string,
    id: string,
  ): Promise<MaterialAvailabilityReport> {
    const order = await this.findOne(organizationId, id);

    const components: ComponentAvailabilityResult[] = [];
    let isAllAvailable = true;

    for (const line of order.lines) {
      const balance = await this.prisma.inventoryBalance.findFirst({
        where: {
          organizationId,
          itemId: line.itemId,
          variantId: line.variantId ?? null,
          locationId: order.locationId,
        },
      });

      const onHand = balance ? Number(balance.quantityOnHand) : 0;
      const reserved = balance ? Number(balance.quantityReserved) : 0;
      const available = Math.max(0, onHand - reserved);
      const remainingNeeded = Math.max(
        0,
        Number(line.requiredQuantity) - Number(line.issuedQuantity),
      );
      const shortage = Math.max(0, remainingNeeded - available);
      const isSufficient = shortage === 0;

      if (!isSufficient) {
        isAllAvailable = false;
      }

      components.push({
        itemId: line.itemId,
        variantId: line.variantId,
        sku: line.item.sku,
        name: line.item.name,
        requiredQuantity: remainingNeeded,
        availableQuantity: available,
        shortageQuantity: shortage,
        isSufficient,
      });
    }

    return {
      productionOrderId: order.id,
      orderNumber: order.orderNumber,
      isAllAvailable,
      components,
    };
  }

  /**
   * Release a DRAFT production order.
   */
  async release(organizationId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id, organizationId },
        include: { lines: { include: { item: true } } },
      });

      if (!order) {
        throw new NotFoundException(
          `Production order with ID ${id} not found.`,
        );
      }

      if (order.status !== ProductionOrderStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot release production order in status ${order.status}. Must be DRAFT.`,
        );
      }

      const config = await tx.manufacturingConfiguration.findUnique({
        where: { organizationId },
      });

      // Availability check
      if (!config?.allowReleaseOnShortage) {
        for (const line of order.lines) {
          const balance = await tx.inventoryBalance.findFirst({
            where: {
              organizationId,
              itemId: line.itemId,
              variantId: line.variantId ?? null,
              locationId: order.locationId,
            },
          });

          const onHand = balance ? Number(balance.quantityOnHand) : 0;
          const reserved = balance ? Number(balance.quantityReserved) : 0;
          const available = Math.max(0, onHand - reserved);
          const remainingNeeded = Number(line.requiredQuantity);

          if (available < remainingNeeded) {
            throw new BadRequestException(
              `Insufficient inventory for component ${line.item.name} (${line.item.sku}). Available: ${available}, Required: ${remainingNeeded}.`,
            );
          }
        }
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionOrderStatus.RELEASED,
          releasedByUserId: userId,
        },
        include: { item: true, location: true, lines: true },
      });

      await this.eventBus.publish({
        eventName: 'PRODUCTION_ORDER_RELEASED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'manufacturing.order.release',
        resource: 'production_order',
        resourceId: id,
        details: { orderNumber: updated.orderNumber },
      });

      return updated;
    });
  }

  /**
   * Start released production order.
   */
  async start(organizationId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id, organizationId },
      });

      if (!order) {
        throw new NotFoundException(
          `Production order with ID ${id} not found.`,
        );
      }

      if (order.status !== ProductionOrderStatus.RELEASED) {
        throw new BadRequestException(
          `Cannot start production order in status ${order.status}. Must be RELEASED.`,
        );
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionOrderStatus.IN_PROGRESS,
          actualStartDate: order.actualStartDate ?? new Date(),
        },
        include: { item: true, location: true, lines: true },
      });

      await this.eventBus.publish({
        eventName: 'PRODUCTION_ORDER_STARTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'manufacturing.order.start',
        resource: 'production_order',
        resourceId: id,
      });

      return updated;
    });
  }

  /**
   * Cancel production order.
   */
  async cancel(organizationId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id, organizationId },
      });

      if (!order) {
        throw new NotFoundException(
          `Production order with ID ${id} not found.`,
        );
      }

      if (
        order.status !== ProductionOrderStatus.DRAFT &&
        order.status !== ProductionOrderStatus.RELEASED
      ) {
        throw new BadRequestException(
          `Cannot cancel production order in status ${order.status}. Only DRAFT or RELEASED orders can be cancelled.`,
        );
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionOrderStatus.CANCELLED,
        },
      });

      await this.eventBus.publish({
        eventName: 'PRODUCTION_CANCELLED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'manufacturing.order.cancel',
        resource: 'production_order',
        resourceId: id,
      });

      return updated;
    });
  }
}
