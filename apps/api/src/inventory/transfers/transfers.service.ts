import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { StockTransferStatus, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../balances/balances.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CompleteTransferDto } from './dto/complete-transfer.dto';
import { StockTransfer } from '@prisma/client';

export type StockTransferWithLocations = StockTransfer & {
  sourceLocation: { id: string; code: string; name: string };
  destinationLocation: { id: string; code: string; name: string };
};

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * List stock transfers in an organization.
   */
  async findAll(
    organizationId: string,
    filter?: { status?: StockTransferStatus },
  ): Promise<StockTransferWithLocations[]> {
    const where: Record<string, unknown> = { organizationId };

    if (filter?.status) {
      where.status = filter.status;
    }

    return this.prisma.stockTransfer.findMany({
      where,
      include: {
        sourceLocation: {
          select: { id: true, code: true, name: true },
        },
        destinationLocation: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find single stock transfer by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<StockTransferWithLocations> {
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        sourceLocation: {
          select: { id: true, code: true, name: true },
        },
        destinationLocation: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException(
        `Stock transfer with ID ${id} not found in organization`,
      );
    }

    return transfer;
  }

  /**
   * Create a new stock transfer record in DRAFT status.
   */
  async createTransfer(
    organizationId: string,
    dto: CreateTransferDto,
    actorUserId: string,
  ): Promise<StockTransferWithLocations> {
    if (dto.sourceLocationId === dto.destinationLocationId) {
      throw new BadRequestException(
        'Source location and destination location must be different',
      );
    }

    // 1. Verify Source Location in Tenant
    const source = await this.prisma.location.findFirst({
      where: {
        id: dto.sourceLocationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!source) {
      throw new NotFoundException(
        `Source location '${dto.sourceLocationId}' not found in organization`,
      );
    }

    // 2. Verify Destination Location in Tenant
    const destination = await this.prisma.location.findFirst({
      where: {
        id: dto.destinationLocationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!destination) {
      throw new NotFoundException(
        `Destination location '${dto.destinationLocationId}' not found in organization`,
      );
    }

    // 3. Generate Transfer Number
    let transferNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'TRANSFER',
        actorUserId,
      );
      transferNumber = generated.formatted;
    } catch {
      // Fallback if numbering sequence is not initialized
      const count = await this.prisma.stockTransfer.count({
        where: { organizationId },
      });
      transferNumber = `TRF-${String(count + 1).padStart(6, '0')}`;
    }

    const transfer = await this.prisma.stockTransfer.create({
      data: {
        organizationId,
        transferNumber,
        sourceLocationId: dto.sourceLocationId,
        destinationLocationId: dto.destinationLocationId,
        status: StockTransferStatus.DRAFT,
        reason: dto.reason ?? null,
        createdByUserId: actorUserId,
      },
      include: {
        sourceLocation: {
          select: { id: true, code: true, name: true },
        },
        destinationLocation: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'STOCK_TRANSFER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'transfer.create',
      resource: 'stock_transfer',
      resourceId: transfer.id,
      details: {
        transferNumber: transfer.transferNumber,
        sourceLocationId: transfer.sourceLocationId,
        destinationLocationId: transfer.destinationLocationId,
      },
    });

    return transfer;
  }

  /**
   * Complete stock transfer by atomically issuing from source and receiving at destination.
   */
  async completeTransfer(
    organizationId: string,
    id: string,
    dto: CompleteTransferDto,
    actorUserId: string,
  ): Promise<StockTransferWithLocations> {
    const transfer = await this.findOne(organizationId, id);

    if (transfer.status !== StockTransferStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT transfers can be completed (current status: ${transfer.status})`,
      );
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException(
        'Transfer must include at least one item line',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        // 1. Deduct from Source (TRANSFER_OUT)
        await this.balancesService.applyStockMovement(
          organizationId,
          {
            itemId: line.itemId,
            variantId: line.variantId,
            locationId: transfer.sourceLocationId,
            movementType: StockMovementType.TRANSFER_OUT,
            quantity: line.quantity,
            batchId: line.batchId,
            serialId: line.serialId,
            referenceType: 'STOCK_TRANSFER',
            referenceId: transfer.transferNumber,
            reason: `Transfer to ${transfer.destinationLocation.code}`,
          },
          actorUserId,
          tx,
        );

        // 2. Add to Destination (TRANSFER_IN)
        await this.balancesService.applyStockMovement(
          organizationId,
          {
            itemId: line.itemId,
            variantId: line.variantId,
            locationId: transfer.destinationLocationId,
            movementType: StockMovementType.TRANSFER_IN,
            quantity: line.quantity,
            batchId: line.batchId,
            serialId: line.serialId,
            referenceType: 'STOCK_TRANSFER',
            referenceId: transfer.transferNumber,
            reason: `Transfer from ${transfer.sourceLocation.code}`,
          },
          actorUserId,
          tx,
        );
      }

      await tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.COMPLETED },
      });
    });

    await this.eventBus.publish({
      eventName: 'STOCK_TRANSFER_COMPLETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'transfer.complete',
      resource: 'stock_transfer',
      resourceId: transfer.id,
      details: {
        transferNumber: transfer.transferNumber,
      },
    });

    return this.findOne(organizationId, id);
  }

  /**
   * Cancel a DRAFT stock transfer.
   */
  async cancelTransfer(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<StockTransferWithLocations> {
    const transfer = await this.findOne(organizationId, id);

    if (transfer.status !== StockTransferStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT transfers can be cancelled (current status: ${transfer.status})`,
      );
    }

    const updated = await this.prisma.stockTransfer.update({
      where: { id },
      data: { status: StockTransferStatus.CANCELLED },
      include: {
        sourceLocation: {
          select: { id: true, code: true, name: true },
        },
        destinationLocation: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'STOCK_TRANSFER_CANCELLED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'transfer.cancel',
      resource: 'stock_transfer',
      resourceId: updated.id,
      details: {
        transferNumber: updated.transferNumber,
      },
    });

    return updated;
  }
}
