import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  AddServicePartRequirementDto,
  ReserveServicePartsDto,
  IssueServicePartsDto,
  ReturnServicePartsDto,
} from '../dto/service-part.dto';
import {
  ServicePartRequirement,
  ServiceOrderStatus,
  StockMovementType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ServicePartsService {
  private readonly logger = new Logger(ServicePartsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findByServiceOrder(
    organizationId: string,
    serviceOrderId: string,
  ): Promise<ServicePartRequirement[]> {
    return this.prisma.servicePartRequirement.findMany({
      where: { organizationId, serviceOrderId },
      include: {
        item: true,
        variant: true,
        warehouse: true,
        location: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addPartRequirement(
    organizationId: string,
    serviceOrderId: string,
    dto: AddServicePartRequirementDto,
    userId: string,
  ): Promise<ServicePartRequirement> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
    });
    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${serviceOrderId} not found in this organization.`,
      );
    }

    if (
      order.status === ServiceOrderStatus.COMPLETED ||
      order.status === ServiceOrderStatus.CLOSED ||
      order.status === ServiceOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot add parts to service order in status: ${order.status}.`,
      );
    }

    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new BadRequestException(
        `Item with ID ${dto.itemId} does not belong to this organization.`,
      );
    }

    const reqQty = new Prisma.Decimal(dto.requiredQuantity);
    if (reqQty.lte(0)) {
      throw new BadRequestException(
        'Required quantity must be greater than 0.',
      );
    }

    return this.prisma.servicePartRequirement.create({
      data: {
        organizationId,
        serviceOrderId: order.id,
        itemId: item.id,
        variantId: dto.variantId || null,
        warehouseId: dto.warehouseId || null,
        locationId: dto.locationId || null,
        requiredQuantity: reqQty,
        reservedQuantity: new Prisma.Decimal(0),
        issuedQuantity: new Prisma.Decimal(0),
        returnedQuantity: new Prisma.Decimal(0),
        unitCost: new Prisma.Decimal(0),
        unitPrice: new Prisma.Decimal(dto.unitPrice || 0),
        warrantyCovered: dto.warrantyCovered ?? false,
      },
      include: {
        item: true,
        variant: true,
      },
    });
  }

  async reserveParts(
    organizationId: string,
    serviceOrderId: string,
    dto: ReserveServicePartsDto,
    userId: string,
  ): Promise<ServicePartRequirement> {
    const partReq = await this.prisma.servicePartRequirement.findFirst({
      where: {
        id: dto.partRequirementId,
        serviceOrderId,
        organizationId,
      },
      include: { serviceOrder: true },
    });

    if (!partReq) {
      throw new NotFoundException(
        `Part requirement with ID ${dto.partRequirementId} not found for this service order.`,
      );
    }

    if (
      partReq.serviceOrder.status === ServiceOrderStatus.COMPLETED ||
      partReq.serviceOrder.status === ServiceOrderStatus.CLOSED ||
      partReq.serviceOrder.status === ServiceOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot reserve parts for service order in status: ${partReq.serviceOrder.status}.`,
      );
    }

    const qtyToReserve = new Prisma.Decimal(dto.quantity);
    if (qtyToReserve.lte(0)) {
      throw new BadRequestException(
        'Reservation quantity must be greater than 0.',
      );
    }

    const maxReservable = partReq.requiredQuantity.minus(
      partReq.reservedQuantity,
    );
    if (qtyToReserve.gt(maxReservable)) {
      throw new BadRequestException(
        `Cannot reserve ${qtyToReserve.toString()} units. Max reservable is ${maxReservable.toString()}.`,
      );
    }

    const updated = await this.prisma.servicePartRequirement.update({
      where: { id: partReq.id },
      data: {
        reservedQuantity: partReq.reservedQuantity.plus(qtyToReserve),
      },
      include: { item: true },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_PART_RESERVED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'reserve_parts',
      resource: 'service_part_requirement',
      resourceId: updated.id,
      details: {
        serviceOrderId,
        quantity: qtyToReserve.toString(),
        totalReserved: updated.reservedQuantity.toString(),
      },
    });

    return updated;
  }

  async issueParts(
    organizationId: string,
    serviceOrderId: string,
    dto: IssueServicePartsDto,
    userId: string,
  ): Promise<ServicePartRequirement> {
    const partReq = await this.prisma.servicePartRequirement.findFirst({
      where: {
        id: dto.partRequirementId,
        serviceOrderId,
        organizationId,
      },
      include: { serviceOrder: true },
    });

    if (!partReq) {
      throw new NotFoundException(
        `Part requirement with ID ${dto.partRequirementId} not found for this service order.`,
      );
    }

    if (
      partReq.serviceOrder.status === ServiceOrderStatus.COMPLETED ||
      partReq.serviceOrder.status === ServiceOrderStatus.CLOSED ||
      partReq.serviceOrder.status === ServiceOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot issue parts for service order in status: ${partReq.serviceOrder.status}.`,
      );
    }

    const qtyToIssue = new Prisma.Decimal(dto.quantity);
    if (qtyToIssue.lte(0)) {
      throw new BadRequestException('Issue quantity must be greater than 0.');
    }

    const maxIssuable = partReq.requiredQuantity.minus(partReq.issuedQuantity);
    if (qtyToIssue.gt(maxIssuable)) {
      throw new BadRequestException(
        `Cannot issue ${qtyToIssue.toString()} units. Max issuable is ${maxIssuable.toString()}.`,
      );
    }

    // Determine unit cost
    let unitCost = new Prisma.Decimal(dto.unitCost || 0);
    if (unitCost.isZero()) {
      // Look up cost layer or item price
      const costLayer = await this.prisma.inventoryCostLayer.findFirst({
        where: {
          itemId: partReq.itemId,
          organizationId,
          remainingQuantity: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (costLayer) {
        unitCost = costLayer.unitCost;
      }
    }

    const addedCost = qtyToIssue.mul(unitCost);

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.servicePartRequirement.update({
        where: { id: partReq.id },
        data: {
          issuedQuantity: partReq.issuedQuantity.plus(qtyToIssue),
          unitCost: unitCost.isZero() ? partReq.unitCost : unitCost,
        },
        include: { item: true },
      });

      // Update ServiceOrder parts cost
      const newPartsCost = partReq.serviceOrder.partsCost.plus(addedCost);
      const newTotalCost = partReq.serviceOrder.totalCost.plus(addedCost);
      let newWarrantyCost = partReq.serviceOrder.warrantyCost;
      let newCustomerCharge = partReq.serviceOrder.customerCharge;

      if (partReq.warrantyCovered) {
        newWarrantyCost = newWarrantyCost.plus(addedCost);
      } else {
        const addedCharge = qtyToIssue.mul(partReq.unitPrice);
        newCustomerCharge = newCustomerCharge.plus(addedCharge);
      }

      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          partsCost: newPartsCost,
          totalCost: newTotalCost,
          warrantyCost: newWarrantyCost,
          customerCharge: newCustomerCharge,
          status:
            partReq.serviceOrder.status === ServiceOrderStatus.RELEASED
              ? ServiceOrderStatus.IN_PROGRESS
              : partReq.serviceOrder.status,
        },
      });

      return p;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_PART_ISSUED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'issue_parts',
      resource: 'service_part_requirement',
      resourceId: updated.id,
      details: {
        serviceOrderId,
        quantity: qtyToIssue.toString(),
        unitCost: unitCost.toString(),
        totalIssued: updated.issuedQuantity.toString(),
      },
    });

    return updated;
  }

  async returnParts(
    organizationId: string,
    serviceOrderId: string,
    dto: ReturnServicePartsDto,
    userId: string,
  ): Promise<ServicePartRequirement> {
    const partReq = await this.prisma.servicePartRequirement.findFirst({
      where: {
        id: dto.partRequirementId,
        serviceOrderId,
        organizationId,
      },
      include: { serviceOrder: true },
    });

    if (!partReq) {
      throw new NotFoundException(
        `Part requirement with ID ${dto.partRequirementId} not found for this service order.`,
      );
    }

    if (
      partReq.serviceOrder.status === ServiceOrderStatus.CLOSED ||
      partReq.serviceOrder.status === ServiceOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot return parts for service order in status: ${partReq.serviceOrder.status}.`,
      );
    }

    const qtyToReturn = new Prisma.Decimal(dto.quantity);
    if (qtyToReturn.lte(0)) {
      throw new BadRequestException('Return quantity must be greater than 0.');
    }

    const maxReturnable = partReq.issuedQuantity.minus(
      partReq.returnedQuantity,
    );
    if (qtyToReturn.gt(maxReturnable)) {
      throw new BadRequestException(
        `Cannot return ${qtyToReturn.toString()} units. Max returnable is ${maxReturnable.toString()}.`,
      );
    }

    const returnedCost = qtyToReturn.mul(partReq.unitCost);

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.servicePartRequirement.update({
        where: { id: partReq.id },
        data: {
          returnedQuantity: partReq.returnedQuantity.plus(qtyToReturn),
        },
        include: { item: true },
      });

      // Update ServiceOrder parts cost
      const newPartsCost = Prisma.Decimal.max(
        0,
        partReq.serviceOrder.partsCost.minus(returnedCost),
      );
      const newTotalCost = Prisma.Decimal.max(
        0,
        partReq.serviceOrder.totalCost.minus(returnedCost),
      );
      let newWarrantyCost = partReq.serviceOrder.warrantyCost;
      let newCustomerCharge = partReq.serviceOrder.customerCharge;

      if (partReq.warrantyCovered) {
        newWarrantyCost = Prisma.Decimal.max(
          0,
          newWarrantyCost.minus(returnedCost),
        );
      } else {
        const returnedCharge = qtyToReturn.mul(partReq.unitPrice);
        newCustomerCharge = Prisma.Decimal.max(
          0,
          newCustomerCharge.minus(returnedCharge),
        );
      }

      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          partsCost: newPartsCost,
          totalCost: newTotalCost,
          warrantyCost: newWarrantyCost,
          customerCharge: newCustomerCharge,
        },
      });

      return p;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_PART_RETURNED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'return_parts',
      resource: 'service_part_requirement',
      resourceId: updated.id,
      details: {
        serviceOrderId,
        quantity: qtyToReturn.toString(),
        totalReturned: updated.returnedQuantity.toString(),
      },
    });

    return updated;
  }
}
