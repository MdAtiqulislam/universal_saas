import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ReceiveReturnDto } from './dto/receive-return.dto';
import { ReturnRequestsService } from '../requests/return-requests.service';
import { ReturnStatus, Prisma } from '@prisma/client';

@Injectable()
export class ReturnReceivingService {
  private readonly logger = new Logger(ReturnReceivingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly returnsService: ReturnRequestsService,
  ) {}

  async receiveReturn(
    organizationId: string,
    returnId: string,
    dto: ReceiveReturnDto,
    userId: string,
  ) {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (
      returnRequest.status !== ReturnStatus.AUTHORIZED &&
      returnRequest.status !== ReturnStatus.AWAITING_RETURN &&
      returnRequest.status !== ReturnStatus.IN_TRANSIT &&
      returnRequest.status !== ReturnStatus.RECEIVED
    ) {
      throw new BadRequestException(
        `Cannot receive goods for return in status: ${returnRequest.status}. Must be AUTHORIZED, AWAITING_RETURN, or IN_TRANSIT.`,
      );
    }

    // Validate warehouse and location exist
    const warehouse = await this.prisma.location.findFirst({
      where: { id: dto.warehouseId, organizationId, isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse ${dto.warehouseId} not found in this organization.`,
      );
    }

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId, isActive: true },
    });
    if (!location) {
      throw new NotFoundException(
        `Location ${dto.locationId} not found in this organization.`,
      );
    }

    // Process receiving quantities
    const updatedReturn = await this.prisma.$transaction(async (tx) => {
      let requiresInspectionOverall = returnRequest.reason.requiresInspection;

      for (const item of dto.items) {
        const line = returnRequest.lines.find((l) => l.id === item.lineId);
        if (!line) {
          throw new BadRequestException(
            `Line ${item.lineId} not found on this return request.`,
          );
        }

        const addRecQty = new Prisma.Decimal(item.receivedQuantity);
        const currentRecQty = new Prisma.Decimal(line.receivedQuantity);
        const authQty = new Prisma.Decimal(line.authorizedQuantity);

        const newRecQty = currentRecQty.plus(addRecQty);
        if (newRecQty.greaterThan(authQty)) {
          throw new BadRequestException(
            `Total received quantity (${newRecQty.toString()}) would exceed authorized quantity (${authQty.toString()}) for line ${line.id}.`,
          );
        }

        await tx.returnRequestLine.update({
          where: { id: item.lineId },
          data: {
            receivedQuantity: newRecQty,
            status: 'RECEIVED',
          },
        });
      }

      // Check policy for auto-quarantine or inspection requirement
      const policy = await tx.returnPolicy.findUnique({
        where: { organizationId },
      });
      if (policy?.requireInspection) {
        requiresInspectionOverall = true;
      }

      const nextStatus = requiresInspectionOverall
        ? ReturnStatus.INSPECTION_REQUIRED
        : ReturnStatus.RECEIVED;

      const received = await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: nextStatus,
          receivedAt: new Date(),
          notes: dto.receivingNotes
            ? `${returnRequest.notes ? returnRequest.notes + '\n' : ''}[Received]: ${dto.receivingNotes}`
            : returnRequest.notes,
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

      return received;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_RECEIVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.receive',
      resource: 'return_request',
      resourceId: updatedReturn.id,
      details: {
        returnNumber: updatedReturn.returnNumber,
        warehouseId: dto.warehouseId,
        locationId: dto.locationId,
        status: updatedReturn.status,
      },
    });

    return updatedReturn;
  }
}
