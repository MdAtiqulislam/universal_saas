import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ReturnRequestsService } from '../requests/return-requests.service';
import { RequestReturnInspectionDto } from './dto/request-inspection.dto';
import { ReturnStatus, InspectionType, Prisma } from '@prisma/client';

@Injectable()
export class ReturnQualityIntegrationService {
  private readonly logger = new Logger(ReturnQualityIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly returnsService: ReturnRequestsService,
  ) {}

  async requestInspection(
    organizationId: string,
    returnId: string,
    dto: RequestReturnInspectionDto,
    userId: string,
  ) {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (
      returnRequest.status !== ReturnStatus.INSPECTION_REQUIRED &&
      returnRequest.status !== ReturnStatus.RECEIVED &&
      returnRequest.status !== ReturnStatus.AUTHORIZED
    ) {
      throw new BadRequestException(
        `Cannot request quality inspection for return in status: ${returnRequest.status}.`,
      );
    }

    if (returnRequest.inspectionLotId) {
      const existingLot = await this.prisma.qualityInspectionLot.findFirst({
        where: { id: returnRequest.inspectionLotId, organizationId },
      });
      if (existingLot) {
        return {
          updatedReturn: returnRequest,
          inspectionLot: existingLot,
          message: 'Inspection lot already exists for this return request.',
        };
      }
    }

    // Determine primary item from return lines
    const primaryLine = returnRequest.lines[0];
    if (!primaryLine) {
      throw new BadRequestException('Return request has no lines to inspect.');
    }

    const totalReturnQty = returnRequest.lines.reduce(
      (sum, l) =>
        sum.plus(
          new Prisma.Decimal(
            l.receivedQuantity || l.authorizedQuantity || l.requestedQuantity,
          ),
        ),
      new Prisma.Decimal(0),
    );

    // Generate inspection lot number
    let lotNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'QLOT',
      );
      lotNumber = seq.formatted;
    } catch {
      const count = await this.prisma.qualityInspectionLot.count({
        where: { organizationId },
      });
      lotNumber = `QLOT-${String(count + 1).padStart(6, '0')}`;
    }

    // Create M31 QualityInspectionLot in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const inspectionLot = await tx.qualityInspectionLot.create({
        data: {
          organizationId,
          lotNumber,
          inspectionType: InspectionType.CUSTOMER_RETURN,
          itemId: primaryLine.itemId,
          variantId: primaryLine.variantId ?? null,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          customerId: returnRequest.customerId ?? null,
          supplierId: returnRequest.supplierId ?? null,
          deliveryOrderId: returnRequest.deliveryOrderId ?? null,
          shipmentId: returnRequest.shipmentId ?? null,
          totalQuantity: totalReturnQty,
          sampleQuantity: totalReturnQty.greaterThan(5)
            ? new Prisma.Decimal(5)
            : totalReturnQty,
          status: 'PENDING',
          notes:
            dto.notes ??
            `Quality inspection for RMA ${returnRequest.returnNumber}`,
        },
      });

      const updatedReturn = await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          inspectionLotId: inspectionLot.id,
          status: ReturnStatus.INSPECTING,
        },
        include: {
          customer: true,
          supplier: true,
          salesOrder: true,
          deliveryOrder: true,
          shipment: true,
          reverseShipment: true,
          customerInvoice: true,
          purchaseOrder: true,
          goodsReceipt: true,
          supplierInvoice: true,
          inspectionLot: true,
          reason: true,
          lines: {
            include: {
              item: true,
              variant: true,
              reason: true,
            },
          },
          dispositions: true,
          resolutions: true,
        },
      });

      return { updatedReturn, inspectionLot };
    });

    await this.eventBus.publish({
      eventName: 'RETURN_INSPECTION_REQUESTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.inspection.request',
      resource: 'return_request',
      resourceId: returnId,
      details: {
        returnNumber: result.updatedReturn.returnNumber,
        inspectionLotId: result.inspectionLot.id,
        lotNumber: result.inspectionLot.lotNumber,
      },
    });

    return result;
  }

  async syncInspectionResult(
    organizationId: string,
    returnId: string,
    userId: string,
  ) {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (!returnRequest.inspectionLotId) {
      throw new BadRequestException(
        'Return request has no linked quality inspection lot.',
      );
    }

    const lot = await this.prisma.qualityInspectionLot.findFirst({
      where: { id: returnRequest.inspectionLotId, organizationId },
      include: { results: true },
    });

    if (!lot) {
      throw new NotFoundException('Linked quality inspection lot not found.');
    }

    // Process line inspected & accepted/rejected quantities based on inspection lot decision
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const line of returnRequest.lines) {
        const recQty = new Prisma.Decimal(line.receivedQuantity);
        let accepted = new Prisma.Decimal(0);
        let rejected = new Prisma.Decimal(0);

        if (
          lot.decision === 'ACCEPT' ||
          lot.decision === 'ACCEPT_WITH_DEVIATION'
        ) {
          accepted = recQty;
          rejected = new Prisma.Decimal(0);
        } else if (
          lot.decision === 'REJECT' ||
          lot.decision === 'SCRAP' ||
          lot.decision === 'RETURN_TO_SUPPLIER'
        ) {
          accepted = new Prisma.Decimal(0);
          rejected = recQty;
        } else {
          // Proportionate if partial
          accepted = new Prisma.Decimal(lot.passedQuantity);
          rejected = new Prisma.Decimal(lot.failedQuantity);
        }

        await tx.returnRequestLine.update({
          where: { id: line.id },
          data: {
            inspectedQuantity: recQty,
            acceptedQuantity: accepted,
            rejectedQuantity: rejected,
            status: 'INSPECTED',
          },
        });
      }

      const updatedRma = await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.DISPOSITION_PENDING,
        },
        include: {
          customer: true,
          supplier: true,
          salesOrder: true,
          deliveryOrder: true,
          shipment: true,
          reverseShipment: true,
          customerInvoice: true,
          purchaseOrder: true,
          goodsReceipt: true,
          supplierInvoice: true,
          inspectionLot: true,
          reason: true,
          lines: {
            include: {
              item: true,
              variant: true,
              reason: true,
            },
          },
          dispositions: true,
          resolutions: true,
        },
      });

      return updatedRma;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_INSPECTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.inspection.synced',
      resource: 'return_request',
      resourceId: updated.id,
      details: {
        returnNumber: updated.returnNumber,
        lotDecision: lot.decision,
      },
    });

    return updated;
  }
}
