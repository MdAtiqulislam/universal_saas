import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ReturnRequestsService } from '../requests/return-requests.service';
import { CreateReturnDispositionDto } from './dto/create-disposition.dto';
import { ReturnDispositionRecord, ReturnStatus, Prisma } from '@prisma/client';

@Injectable()
export class ReturnDispositionService {
  private readonly logger = new Logger(ReturnDispositionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly returnsService: ReturnRequestsService,
  ) {}

  async findByReturn(
    organizationId: string,
    returnRequestId: string,
  ): Promise<ReturnDispositionRecord[]> {
    return this.prisma.returnDispositionRecord.findMany({
      where: { organizationId, returnRequestId },
      include: {
        returnLine: {
          include: { item: true, variant: true },
        },
        warehouse: true,
        location: true,
      },
      orderBy: { processedAt: 'desc' },
    });
  }

  async createDispositions(
    organizationId: string,
    returnId: string,
    dto: CreateReturnDispositionDto,
    userId: string,
  ) {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (
      returnRequest.status === ReturnStatus.CLOSED ||
      returnRequest.status === ReturnStatus.REJECTED ||
      returnRequest.status === ReturnStatus.CANCELLED ||
      returnRequest.status === ReturnStatus.VOIDED
    ) {
      throw new BadRequestException(
        `Cannot create dispositions for return in status: ${returnRequest.status}.`,
      );
    }

    const createdRecords = await this.prisma.$transaction(async (tx) => {
      const records = [];

      for (const disp of dto.dispositions) {
        const line = returnRequest.lines.find(
          (l) => l.id === disp.returnLineId,
        );
        if (!line) {
          throw new BadRequestException(
            `Line ${disp.returnLineId} not found on this return request.`,
          );
        }

        const dispQty = new Prisma.Decimal(disp.quantity);
        if (dispQty.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'Disposition quantity must be strictly positive.',
          );
        }

        // Validate available eligible quantity for disposition
        // Eligible qty is receivedQuantity or acceptedQuantity
        const eligibleQty = new Prisma.Decimal(
          line.acceptedQuantity.greaterThan(0)
            ? line.acceptedQuantity
            : line.receivedQuantity.greaterThan(0)
              ? line.receivedQuantity
              : line.authorizedQuantity,
        );

        // Sum existing dispositions for this line
        const existingDisps = await tx.returnDispositionRecord.findMany({
          where: { organizationId, returnLineId: disp.returnLineId },
        });

        const totalPriorDisp = existingDisps.reduce(
          (sum, d) => sum.plus(new Prisma.Decimal(d.quantity)),
          new Prisma.Decimal(0),
        );

        const newTotalDisp = totalPriorDisp.plus(dispQty);
        if (newTotalDisp.greaterThan(eligibleQty)) {
          throw new BadRequestException(
            `Total disposition quantity (${newTotalDisp.toString()}) exceeds eligible quantity (${eligibleQty.toString()}) for line ${line.id}. Prior dispositions: ${totalPriorDisp.toString()}.`,
          );
        }

        // Validate warehouse & location
        const warehouse = await tx.location.findFirst({
          where: { id: disp.warehouseId, organizationId, isActive: true },
        });
        if (!warehouse) {
          throw new NotFoundException(
            `Warehouse ${disp.warehouseId} not found.`,
          );
        }

        const location = await tx.location.findFirst({
          where: { id: disp.locationId, organizationId, isActive: true },
        });
        if (!location) {
          throw new NotFoundException(`Location ${disp.locationId} not found.`);
        }

        const record = await tx.returnDispositionRecord.create({
          data: {
            organizationId,
            returnRequestId: returnId,
            returnLineId: disp.returnLineId,
            dispositionType: disp.dispositionType,
            quantity: dispQty,
            warehouseId: disp.warehouseId,
            locationId: disp.locationId,
            inspectionLotId: returnRequest.inspectionLotId ?? null,
            referenceNotes: disp.referenceNotes?.trim() ?? null,
            processedByUserId: userId,
          },
          include: {
            returnLine: {
              include: { item: true, variant: true },
            },
            warehouse: true,
            location: true,
          },
        });

        // Update line status
        await tx.returnRequestLine.update({
          where: { id: disp.returnLineId },
          data: { status: 'DISPOSITIONED' },
        });

        records.push(record);
      }

      // Update return request status if in DISPOSITION_PENDING
      await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.DISPOSITION_PENDING,
        },
      });

      return records;
    });

    for (const record of createdRecords) {
      await this.eventBus.publish({
        eventName: 'RETURN_DISPOSITION_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'returns.disposition.create',
        resource: 'return_disposition',
        resourceId: record.id,
        details: {
          returnRequestId: returnId,
          returnLineId: record.returnLineId,
          dispositionType: record.dispositionType,
          quantity: record.quantity,
        },
      });

      if (record.dispositionType === 'RESTOCK') {
        await this.eventBus.publish({
          eventName: 'RETURN_RESTOCKED',
          occurredAt: new Date(),
          organizationId,
          actorUserId: userId,
          action: 'returns.restock',
          resource: 'return_disposition',
          resourceId: record.id,
          details: { returnId, quantity: record.quantity },
        });
      } else if (record.dispositionType === 'SCRAP') {
        await this.eventBus.publish({
          eventName: 'RETURN_SCRAPPED',
          occurredAt: new Date(),
          organizationId,
          actorUserId: userId,
          action: 'returns.scrap',
          resource: 'return_disposition',
          resourceId: record.id,
          details: { returnId, quantity: record.quantity },
        });
      }
    }

    return createdRecords;
  }
}
