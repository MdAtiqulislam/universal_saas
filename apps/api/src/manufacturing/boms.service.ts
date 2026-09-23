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
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { BomQueryDto } from './dto/bom-query.dto';
import { BomStatus, Prisma } from '@prisma/client';

@Injectable()
export class BomsService {
  private readonly logger = new Logger(BomsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Create a new Bill of Materials.
   */
  async create(organizationId: string, dto: CreateBomDto, userId: string) {
    // 1. Verify item exists in organization
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item with ID ${dto.itemId} not found.`);
    }

    if (dto.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: { id: dto.variantId, itemId: dto.itemId, organizationId },
      });
      if (!variant) {
        throw new NotFoundException(
          `ItemVariant with ID ${dto.variantId} not found for this item.`,
        );
      }
    }

    // 2. Validate UOM
    const uom = await this.prisma.unitOfMeasure.findFirst({
      where: { id: dto.uomId, organizationId },
    });
    if (!uom) {
      throw new NotFoundException(`UOM with ID ${dto.uomId} not found.`);
    }

    // 3. Validate lines & prevent self-reference
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'BOM must contain at least one component line.',
      );
    }

    for (const line of dto.lines) {
      if (line.itemId === dto.itemId) {
        throw new BadRequestException(
          'BOM cannot reference the finished product item as a component (self-reference).',
        );
      }
      if (line.quantity <= 0) {
        throw new BadRequestException(
          'Component line quantity must be strictly positive.',
        );
      }
      if (
        line.scrapPercentage &&
        (line.scrapPercentage < 0 || line.scrapPercentage > 100)
      ) {
        throw new BadRequestException(
          'Scrap percentage must be between 0 and 100.',
        );
      }
    }

    // 4. Validate circular dependencies recursively
    await this.detectCircularBom(
      organizationId,
      dto.itemId,
      dto.lines.map((l) => l.itemId),
    );

    // 5. Generate BOM number
    let bomNumber = dto.bomNumber;
    if (!bomNumber) {
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'BOM',
          userId,
        );
        bomNumber = seq.formatted;
      } catch {
        const count = await this.prisma.billOfMaterial.count({
          where: { organizationId },
        });
        bomNumber = `BOM-${String(count + 1).padStart(6, '0')}`;
      }
    } else {
      const duplicate = await this.prisma.billOfMaterial.findUnique({
        where: {
          organizationId_bomNumber: {
            organizationId,
            bomNumber,
          },
        },
      });
      if (duplicate) {
        throw new ConflictException(`BOM number ${bomNumber} already exists.`);
      }
    }

    // 6. Create BOM header and lines atomically
    const created = await this.prisma.$transaction(async (tx) => {
      const bom = await tx.billOfMaterial.create({
        data: {
          organizationId,
          bomNumber: bomNumber,
          name: dto.name,
          description: dto.description,
          itemId: dto.itemId,
          variantId: dto.variantId ?? null,
          quantity: new Prisma.Decimal(dto.quantity ?? 1),
          uomId: dto.uomId,
          version: dto.version ?? 1,
          status: BomStatus.DRAFT,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveUntil: dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null,
          notes: dto.notes,
          lines: {
            create: dto.lines.map((l, index) => ({
              organizationId,
              itemId: l.itemId,
              variantId: l.variantId ?? null,
              quantity: new Prisma.Decimal(l.quantity),
              uomId: l.uomId,
              scrapPercentage: new Prisma.Decimal(l.scrapPercentage ?? 0),
              lineNumber: index + 1,
              notes: l.notes,
            })),
          },
        },
        include: {
          lines: {
            include: { item: true, uom: true },
          },
          item: true,
          uom: true,
        },
      });

      return bom;
    });

    await this.eventBus.publish({
      eventName: 'BOM_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'manufacturing.bom.create',
      resource: 'bill_of_material',
      resourceId: created.id,
      details: {
        bomNumber: created.bomNumber,
        itemId: created.itemId,
        version: created.version,
        lineCount: created.lines.length,
      },
    });

    return created;
  }

  /**
   * List BOMs with filtering and pagination.
   */
  async findAll(organizationId: string, query: BomQueryDto) {
    const where: Prisma.BillOfMaterialWhereInput = { organizationId };

    if (query.itemId) {
      where.itemId = query.itemId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { bomNumber: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.billOfMaterial.findMany({
        where,
        include: {
          item: true,
          uom: true,
          lines: {
            include: { item: true, uom: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.billOfMaterial.count({ where }),
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
   * Find single BOM by ID.
   */
  async findOne(organizationId: string, id: string) {
    const bom = await this.prisma.billOfMaterial.findFirst({
      where: { id, organizationId },
      include: {
        item: true,
        variant: true,
        uom: true,
        lines: {
          include: { item: true, variant: true, uom: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!bom) {
      throw new NotFoundException(`BOM with ID ${id} not found.`);
    }

    return bom;
  }

  /**
   * Update a BOM.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateBomDto,
    userId: string,
  ) {
    const bom = await this.findOne(organizationId, id);

    // Check if referenced by active/closed production orders (Immutability check)
    const productionOrderCount = await this.prisma.productionOrder.count({
      where: {
        organizationId,
        bomId: id,
        status: {
          in: [
            'RELEASED',
            'IN_PROGRESS',
            'PARTIALLY_COMPLETED',
            'COMPLETED',
            'CLOSED',
          ],
        },
      },
    });

    if (productionOrderCount > 0) {
      throw new BadRequestException(
        'Cannot modify a BOM that is already referenced by active or completed production orders. Create a new version instead.',
      );
    }

    if (dto.lines && dto.lines.length > 0) {
      for (const line of dto.lines) {
        if (line.itemId === (dto.itemId ?? bom.itemId)) {
          throw new BadRequestException(
            'BOM cannot reference the finished product item as a component (self-reference).',
          );
        }
      }
      await this.detectCircularBom(
        organizationId,
        dto.itemId ?? bom.itemId,
        dto.lines.map((l) => l.itemId),
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.billOfMaterialLine.deleteMany({
          where: { bomId: id, organizationId },
        });
      }

      return tx.billOfMaterial.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          itemId: dto.itemId,
          variantId: dto.variantId,
          quantity: dto.quantity ? new Prisma.Decimal(dto.quantity) : undefined,
          uomId: dto.uomId,
          version: dto.version,
          effectiveFrom: dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : undefined,
          effectiveUntil: dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : undefined,
          notes: dto.notes,
          lines: dto.lines
            ? {
                create: dto.lines.map((l, index) => ({
                  organizationId,
                  itemId: l.itemId,
                  variantId: l.variantId ?? null,
                  quantity: new Prisma.Decimal(l.quantity),
                  uomId: l.uomId,
                  scrapPercentage: new Prisma.Decimal(l.scrapPercentage ?? 0),
                  lineNumber: index + 1,
                  notes: l.notes,
                })),
              }
            : undefined,
        },
        include: {
          item: true,
          uom: true,
          lines: {
            include: { item: true, uom: true },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'BOM_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'manufacturing.bom.update',
      resource: 'bill_of_material',
      resourceId: updated.id,
    });

    return updated;
  }

  /**
   * Delete a BOM.
   */
  async delete(organizationId: string, id: string, userId: string) {
    const bom = await this.findOne(organizationId, id);

    const referencedCount = await this.prisma.productionOrder.count({
      where: { organizationId, bomId: id },
    });

    if (referencedCount > 0) {
      throw new BadRequestException(
        'Cannot delete a BOM that is referenced by production orders.',
      );
    }

    await this.prisma.billOfMaterial.delete({
      where: { id },
    });

    await this.eventBus.publish({
      eventName: 'BOM_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'manufacturing.bom.delete',
      resource: 'bill_of_material',
      resourceId: id,
      details: { bomNumber: bom.bomNumber },
    });

    return { success: true };
  }

  /**
   * Activate a BOM.
   */
  async activate(organizationId: string, id: string, userId: string) {
    const bom = await this.findOne(organizationId, id);

    if (bom.status === BomStatus.ACTIVE) {
      return bom;
    }

    // Verify no circular references
    await this.detectCircularBom(
      organizationId,
      bom.itemId,
      bom.lines.map((l) => l.itemId),
    );

    const updated = await this.prisma.billOfMaterial.update({
      where: { id },
      data: { status: BomStatus.ACTIVE },
      include: { item: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'BOM_ACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'manufacturing.bom.activate',
      resource: 'bill_of_material',
      resourceId: id,
    });

    return updated;
  }

  /**
   * Deactivate a BOM.
   */
  async deactivate(organizationId: string, id: string, userId: string) {
    await this.findOne(organizationId, id);

    const updated = await this.prisma.billOfMaterial.update({
      where: { id },
      data: { status: BomStatus.INACTIVE },
      include: { item: true, lines: true },
    });

    await this.eventBus.publish({
      eventName: 'BOM_DEACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'manufacturing.bom.deactivate',
      resource: 'bill_of_material',
      resourceId: id,
    });

    return updated;
  }

  /**
   * Recursive circular BOM dependency detection.
   */
  private async detectCircularBom(
    organizationId: string,
    targetItemId: string,
    componentItemIds: string[],
    visited = new Set<string>(),
  ): Promise<void> {
    for (const compId of componentItemIds) {
      if (compId === targetItemId) {
        throw new BadRequestException(
          `Circular BOM dependency detected: Item ${compId} is referenced directly or indirectly in its own BOM tree.`,
        );
      }

      if (visited.has(compId)) {
        continue;
      }
      visited.add(compId);

      // Find sub-BOMs for this component
      const subBoms = await this.prisma.billOfMaterial.findMany({
        where: {
          organizationId,
          itemId: compId,
          status: { in: [BomStatus.ACTIVE, BomStatus.DRAFT] },
        },
        include: { lines: true },
      });

      for (const subBom of subBoms) {
        const subComponentIds = subBom.lines.map((l) => l.itemId);
        await this.detectCircularBom(
          organizationId,
          targetItemId,
          subComponentIds,
          visited,
        );
      }
    }
  }
}
