import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { QuarantineStockDto } from './dto/quarantine-stock.dto';
import {
  InspectQuarantineDto,
  ReleaseQuarantineDto,
  QuarantineQueryDto,
} from './dto/inspect-quarantine.dto';
import { QuarantineRecord, QuarantineStatus, Prisma } from '@prisma/client';

export type QuarantineRecordWithDetails = QuarantineRecord & {
  warehouse: { id: string; code: string; name: string };
  location: { id: string; code: string; name: string };
  item: { id: string; sku: string; name: string };
  variant: { id: string; sku: string } | null;
  batch: { id: string; batchNumber: string } | null;
  serial: { id: string; serialNumber: string } | null;
};

@Injectable()
export class WarehouseQuarantineService {
  private readonly logger = new Logger(WarehouseQuarantineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Place stock into quarantine.
   */
  async quarantineStock(
    organizationId: string,
    dto: QuarantineStockDto,
    actorUserId?: string,
  ): Promise<QuarantineRecordWithDetails> {
    const qty = new Prisma.Decimal(dto.quantity);
    if (qty.lte(0)) {
      throw new BadRequestException(
        'Quarantine quantity must be strictly positive',
      );
    }

    const [warehouse, location, item] = await Promise.all([
      this.prisma.location.findFirst({
        where: { id: dto.warehouseId, organizationId },
      }),
      this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId },
      }),
      this.prisma.item.findFirst({
        where: { id: dto.itemId, organizationId },
      }),
    ]);

    if (!warehouse) {
      throw new NotFoundException(`Warehouse ID ${dto.warehouseId} not found`);
    }
    if (!location) {
      throw new NotFoundException(`Location ID ${dto.locationId} not found`);
    }
    if (!item) {
      throw new NotFoundException(`Item ID ${dto.itemId} not found`);
    }

    // Check balance on hand
    const balance = await this.prisma.inventoryBalance.findFirst({
      where: {
        organizationId,
        locationId: dto.locationId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
      },
    });

    if (!balance || balance.quantityOnHand.lt(qty)) {
      throw new BadRequestException(
        `Insufficient on-hand stock at location '${location.code}' (On-hand: ${
          balance?.quantityOnHand.toString() || '0'
        }, Requested: ${qty.toString()})`,
      );
    }

    let quarantineNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'QUARANTINE',
        actorUserId,
      );
      quarantineNumber = seq.formatted;
    } catch {
      const count = await this.prisma.quarantineRecord.count({
        where: { organizationId },
      });
      quarantineNumber = `QR-${String(count + 1).padStart(6, '0')}`;
    }

    const record = await this.prisma.quarantineRecord.create({
      data: {
        organizationId,
        quarantineNumber,
        warehouseId: dto.warehouseId,
        locationId: dto.locationId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
        batchId: dto.batchId ?? null,
        serialId: dto.serialId ?? null,
        quantity: qty,
        status: QuarantineStatus.QUARANTINED,
        reason: dto.reason.trim(),
        sourceDocumentType: dto.sourceDocumentType ?? null,
        sourceDocumentId: dto.sourceDocumentId ?? null,
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        batch: { select: { id: true, batchNumber: true } },
        serial: { select: { id: true, serialNumber: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_STOCK_QUARANTINED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.quarantine',
      resource: 'quarantine_record',
      resourceId: record.id,
      details: {
        quarantineNumber: record.quarantineNumber,
        itemId: record.itemId,
        quantity: record.quantity.toString(),
      },
    });

    return record;
  }

  /**
   * Inspect quarantined stock lot and record disposition.
   */
  async inspect(
    organizationId: string,
    id: string,
    dto: InspectQuarantineDto,
    actorUserId?: string,
  ): Promise<QuarantineRecordWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (
      existing.status === QuarantineStatus.RELEASED ||
      existing.status === QuarantineStatus.SCRAPPED ||
      existing.status === QuarantineStatus.RETURNED
    ) {
      throw new BadRequestException(
        `Quarantine record is already in terminal status ${existing.status}`,
      );
    }

    const updated = await this.prisma.quarantineRecord.update({
      where: { id },
      data: {
        status: dto.status,
        disposition: dto.disposition.trim(),
        dispositionNotes: dto.dispositionNotes?.trim() ?? null,
        inspectedByUserId: actorUserId ?? null,
        inspectedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        batch: { select: { id: true, batchNumber: true } },
        serial: { select: { id: true, serialNumber: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_STOCK_INSPECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.inspect_quarantine',
      resource: 'quarantine_record',
      resourceId: updated.id,
      details: {
        quarantineNumber: updated.quarantineNumber,
        status: updated.status,
        disposition: updated.disposition,
      },
    });

    return updated;
  }

  /**
   * Release quarantined stock back to available inventory.
   */
  async release(
    organizationId: string,
    id: string,
    dto: ReleaseQuarantineDto = {},
    actorUserId?: string,
  ): Promise<QuarantineRecordWithDetails> {
    const existing = await this.findOne(organizationId, id);

    if (existing.status === QuarantineStatus.RELEASED) {
      throw new BadRequestException('Quarantine record is already released');
    }

    const updated = await this.prisma.quarantineRecord.update({
      where: { id },
      data: {
        status: QuarantineStatus.RELEASED,
        disposition: 'RELEASE',
        dispositionNotes: dto.notes?.trim() ?? existing.dispositionNotes,
        releasedByUserId: actorUserId ?? null,
        releasedAt: new Date(),
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        batch: { select: { id: true, batchNumber: true } },
        serial: { select: { id: true, serialNumber: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_STOCK_RELEASED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.release_quarantine',
      resource: 'quarantine_record',
      resourceId: updated.id,
      details: {
        quarantineNumber: updated.quarantineNumber,
      },
    });

    return updated;
  }

  /**
   * List quarantine records.
   */
  async findAll(
    organizationId: string,
    query: QuarantineQueryDto,
  ): Promise<QuarantineRecordWithDetails[]> {
    const where: Prisma.QuarantineRecordWhereInput = { organizationId };

    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.itemId) where.itemId = query.itemId;
    if (query.status) where.status = query.status;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { quarantineNumber: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { item: { sku: { contains: search, mode: 'insensitive' } } },
        { item: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.quarantineRecord.findMany({
      where,
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        batch: { select: { id: true, batchNumber: true } },
        serial: { select: { id: true, serialNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find single quarantine record by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<QuarantineRecordWithDetails> {
    const record = await this.prisma.quarantineRecord.findFirst({
      where: { id, organizationId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true } },
        batch: { select: { id: true, batchNumber: true } },
        serial: { select: { id: true, serialNumber: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Quarantine record with ID ${id} not found`);
    }

    return record;
  }
}
