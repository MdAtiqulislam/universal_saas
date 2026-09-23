import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateQualityHoldDto,
  ReleaseQualityHoldDto,
  QueryQualityHoldsDto,
} from './dto/quality-hold.dto';
import { Prisma, QualityHoldStatus } from '@prisma/client';

@Injectable()
export class QualityHoldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findAll(organizationId: string, query?: QueryQualityHoldsDto) {
    const where: Prisma.QualityHoldWhereInput = { organizationId };

    if (query?.status) {
      where.status = query.status;
    }
    if (query?.itemId) {
      where.itemId = query.itemId;
    }
    if (query?.warehouseId) {
      where.warehouseId = query.warehouseId;
    }
    if (query?.search) {
      where.OR = [
        { holdNumber: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.qualityHold.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        inspectionLot: { select: { id: true, lotNumber: true } },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const hold = await this.prisma.qualityHold.findFirst({
      where: { id, organizationId },
      include: {
        item: true,
        variant: true,
        warehouse: true,
        location: true,
        batch: true,
        serial: true,
        inspectionLot: true,
      },
    });

    if (!hold) {
      throw new NotFoundException(`Quality hold ${id} not found`);
    }

    return hold;
  }

  async create(
    organizationId: string,
    dto: CreateQualityHoldDto,
    userId: string,
  ) {
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item ${dto.itemId} not found`);
    }

    const warehouse = await this.prisma.location.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${dto.warehouseId} not found`);
    }

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId },
    });
    if (!location) {
      throw new NotFoundException(`Location ${dto.locationId} not found`);
    }

    const holdSeq = await this.numberingService.nextNumber(
      organizationId,
      'QUALITY_HOLD',
      'QHD-',
    );

    const hold = await this.prisma.qualityHold.create({
      data: {
        organizationId,
        holdNumber: holdSeq.formatted,
        inspectionLotId: dto.inspectionLotId,
        itemId: dto.itemId,
        variantId: dto.variantId,
        warehouseId: dto.warehouseId,
        locationId: dto.locationId,
        batchId: dto.batchId,
        serialId: dto.serialId,
        holdQuantity: new Prisma.Decimal(dto.holdQuantity),
        status: QualityHoldStatus.ACTIVE,
        reason: dto.reason,
        notes: dto.notes,
        createdByUserId: userId,
      },
      include: {
        item: true,
        warehouse: true,
        location: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUALITY_HOLD_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.hold.create',
      resource: 'quality_hold',
      resourceId: hold.id,
      details: {
        holdNumber: hold.holdNumber,
        itemId: hold.itemId,
        holdQuantity: hold.holdQuantity.toString(),
      },
    });

    return hold;
  }

  async release(
    organizationId: string,
    id: string,
    dto: ReleaseQualityHoldDto,
    userId: string,
  ) {
    const hold = await this.findOne(organizationId, id);

    if (hold.status !== QualityHoldStatus.ACTIVE) {
      throw new BadRequestException(
        `Quality hold ${hold.holdNumber} is not active (current status: ${hold.status})`,
      );
    }

    const targetStatus = dto.dispositionStatus ?? QualityHoldStatus.RELEASED;

    const updated = await this.prisma.qualityHold.update({
      where: { id: hold.id },
      data: {
        status: targetStatus,
        releasedByUserId: userId,
        releasedAt: new Date(),
        releaseNotes: dto.releaseNotes,
      },
      include: {
        item: true,
        warehouse: true,
        location: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUALITY_HOLD_RELEASED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.hold.release',
      resource: 'quality_hold',
      resourceId: updated.id,
      details: {
        holdNumber: updated.holdNumber,
        status: updated.status,
      },
    });

    return updated;
  }
}
