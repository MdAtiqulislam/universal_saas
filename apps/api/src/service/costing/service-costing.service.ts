import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface ServiceCostingBreakdown {
  serviceOrderId: string;
  partsCost: Prisma.Decimal;
  partsCharge: Prisma.Decimal;
  laborCost: Prisma.Decimal;
  laborCharge: Prisma.Decimal;
  otherCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  warrantyCost: Prisma.Decimal;
  customerCharge: Prisma.Decimal;
  serviceMargin: Prisma.Decimal;
  serviceMarginPercentage: number;
}

@Injectable()
export class ServiceCostingService {
  private readonly logger = new Logger(ServiceCostingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateCosting(
    organizationId: string,
    serviceOrderId: string,
  ): Promise<ServiceCostingBreakdown> {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
      include: {
        partsRequirements: true,
        laborEntries: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${serviceOrderId} not found in this organization.`,
      );
    }

    let partsCost = new Prisma.Decimal(0);
    let partsCharge = new Prisma.Decimal(0);
    let laborCost = new Prisma.Decimal(0);
    let laborCharge = new Prisma.Decimal(0);
    let warrantyCost = new Prisma.Decimal(0);
    let customerCharge = new Prisma.Decimal(0);

    // Calculate Parts
    for (const part of order.partsRequirements) {
      const netIssued = Prisma.Decimal.max(
        0,
        part.issuedQuantity.minus(part.returnedQuantity),
      );
      const cost = netIssued.mul(part.unitCost);
      const charge = netIssued.mul(part.unitPrice);

      partsCost = partsCost.plus(cost);
      if (part.warrantyCovered) {
        warrantyCost = warrantyCost.plus(cost);
      } else {
        partsCharge = partsCharge.plus(charge);
        customerCharge = customerCharge.plus(charge);
      }
    }

    // Calculate Labor
    for (const labor of order.laborEntries) {
      laborCost = laborCost.plus(labor.laborCost);
      if (labor.warrantyCovered) {
        warrantyCost = warrantyCost.plus(labor.laborCost);
      } else {
        laborCharge = laborCharge.plus(labor.laborCharge);
        customerCharge = customerCharge.plus(labor.laborCharge);
      }
    }

    const otherCost = order.otherCost;
    const totalCost = partsCost.plus(laborCost).plus(otherCost);
    const serviceMargin = customerCharge.minus(totalCost);

    const marginPct = customerCharge.gt(0)
      ? serviceMargin.div(customerCharge).mul(100).toNumber()
      : 0;

    return {
      serviceOrderId,
      partsCost,
      partsCharge,
      laborCost,
      laborCharge,
      otherCost,
      totalCost,
      warrantyCost,
      customerCharge,
      serviceMargin,
      serviceMarginPercentage: Number(marginPct.toFixed(2)),
    };
  }

  async recalculateAndPersist(organizationId: string, serviceOrderId: string) {
    const breakdown = await this.calculateCosting(
      organizationId,
      serviceOrderId,
    );

    return this.prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        partsCost: breakdown.partsCost,
        laborCost: breakdown.laborCost,
        totalCost: breakdown.totalCost,
        warrantyCost: breakdown.warrantyCost,
        customerCharge: breakdown.customerCharge,
      },
    });
  }
}
