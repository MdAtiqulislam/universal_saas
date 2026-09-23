import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ManufacturingReportsQueryDto } from './dto/manufacturing-reports-query.dto';
import { ProductionOrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class ManufacturingReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Production Summary Report.
   */
  async getProductionSummary(
    organizationId: string,
    query: ManufacturingReportsQueryDto,
  ) {
    const where: Prisma.ProductionOrderWhereInput = { organizationId };

    if (query.itemId) where.itemId = query.itemId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.status = query.status;
    if (query.startDate)
      where.plannedStartDate = { gte: new Date(query.startDate) };
    if (query.endDate)
      where.plannedCompletionDate = { lte: new Date(query.endDate) };

    const orders = await this.prisma.productionOrder.findMany({
      where,
      include: {
        item: true,
        location: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPlanned = orders.reduce(
      (sum, o) => sum.plus(o.plannedQuantity),
      new Prisma.Decimal(0),
    );
    const totalProduced = orders.reduce(
      (sum, o) => sum.plus(o.producedQuantity),
      new Prisma.Decimal(0),
    );
    const totalScrap = orders.reduce(
      (sum, o) => sum.plus(o.scrapQuantity),
      new Prisma.Decimal(0),
    );
    const totalCost = orders.reduce(
      (sum, o) => sum.plus(o.totalCost),
      new Prisma.Decimal(0),
    );

    const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    return {
      orderCount: orders.length,
      totalPlannedQuantity: totalPlanned,
      totalProducedQuantity: totalProduced,
      totalScrapQuantity: totalScrap,
      totalProductionCost: totalCost,
      statusBreakdown: statusCounts,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        itemSku: o.item.sku,
        itemName: o.item.name,
        locationName: o.location.name,
        plannedQuantity: o.plannedQuantity,
        producedQuantity: o.producedQuantity,
        scrapQuantity: o.scrapQuantity,
        totalCost: o.totalCost,
        unitCost: o.unitCost,
        status: o.status,
        plannedStartDate: o.plannedStartDate,
        plannedCompletionDate: o.plannedCompletionDate,
      })),
    };
  }

  /**
   * Material Consumption Report.
   */
  async getMaterialConsumption(
    organizationId: string,
    query: ManufacturingReportsQueryDto,
  ) {
    const where: Prisma.ProductionMaterialIssueWhereInput = { organizationId };

    if (query.itemId) where.itemId = query.itemId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.startDate) where.issueDate = { gte: new Date(query.startDate) };
    if (query.endDate) where.issueDate = { lte: new Date(query.endDate) };

    const issues = await this.prisma.productionMaterialIssue.findMany({
      where,
      include: {
        item: true,
        location: true,
        productionOrder: true,
      },
      orderBy: { issueDate: 'desc' },
    });

    const totalQuantity = issues.reduce(
      (sum, i) => sum.plus(i.quantity),
      new Prisma.Decimal(0),
    );
    const totalCost = issues.reduce(
      (sum, i) => sum.plus(i.totalCost),
      new Prisma.Decimal(0),
    );

    return {
      issueCount: issues.length,
      totalQuantityIssued: totalQuantity,
      totalMaterialCost: totalCost,
      issues: issues.map((i) => ({
        id: i.id,
        orderNumber: i.productionOrder.orderNumber,
        itemSku: i.item.sku,
        itemName: i.item.name,
        locationName: i.location.name,
        quantity: i.quantity,
        unitCost: i.unitCost,
        totalCost: i.totalCost,
        issueDate: i.issueDate,
      })),
    };
  }

  /**
   * Production Costing Report.
   */
  async getProductionCost(
    organizationId: string,
    query: ManufacturingReportsQueryDto,
  ) {
    const where: Prisma.ProductionOrderWhereInput = { organizationId };

    if (query.itemId) where.itemId = query.itemId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.status = query.status;

    const orders = await this.prisma.productionOrder.findMany({
      where,
      include: { item: true, location: true },
    });

    const totalMaterial = orders.reduce(
      (sum, o) => sum.plus(o.materialCost),
      new Prisma.Decimal(0),
    );
    const totalLabor = orders.reduce(
      (sum, o) => sum.plus(o.laborCost),
      new Prisma.Decimal(0),
    );
    const totalOverhead = orders.reduce(
      (sum, o) => sum.plus(o.overheadCost),
      new Prisma.Decimal(0),
    );
    const totalCost = totalMaterial.plus(totalLabor).plus(totalOverhead);

    return {
      totalMaterialCost: totalMaterial,
      totalLaborCost: totalLabor,
      totalOverheadCost: totalOverhead,
      totalProductionCost: totalCost,
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        itemSku: o.item.sku,
        itemName: o.item.name,
        materialCost: o.materialCost,
        laborCost: o.laborCost,
        overheadCost: o.overheadCost,
        totalCost: o.totalCost,
        unitCost: o.unitCost,
        producedQuantity: o.producedQuantity,
      })),
    };
  }

  /**
   * Work-in-Progress (WIP) Report.
   */
  async getWipReport(organizationId: string) {
    const activeOrders = await this.prisma.productionOrder.findMany({
      where: {
        organizationId,
        status: {
          in: [
            ProductionOrderStatus.IN_PROGRESS,
            ProductionOrderStatus.PARTIALLY_COMPLETED,
          ],
        },
      },
      include: {
        item: true,
        location: true,
        lines: { include: { item: true } },
        materialIssues: true,
      },
    });

    const totalWipValue = activeOrders.reduce(
      (sum, o) => sum.plus(o.materialCost),
      new Prisma.Decimal(0),
    );

    return {
      activeWipOrderCount: activeOrders.length,
      totalWipValuation: totalWipValue,
      orders: activeOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        itemSku: o.item.sku,
        itemName: o.item.name,
        locationName: o.location.name,
        plannedQuantity: o.plannedQuantity,
        producedQuantity: o.producedQuantity,
        wipMaterialCost: o.materialCost,
        actualStartDate: o.actualStartDate,
      })),
    };
  }

  /**
   * Production Variance Report.
   */
  async getProductionVariance(
    organizationId: string,
    query: ManufacturingReportsQueryDto,
  ) {
    const where: Prisma.ProductionOrderWhereInput = {
      organizationId,
      status: {
        in: [ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CLOSED],
      },
    };

    if (query.itemId) where.itemId = query.itemId;

    const orders = await this.prisma.productionOrder.findMany({
      where,
      include: { item: true, outputs: true },
    });

    return {
      analyzedOrdersCount: orders.length,
      variances: orders.map((o) => {
        const outputCost = o.outputs.reduce(
          (sum, out) => sum.plus(out.totalCost),
          new Prisma.Decimal(0),
        );
        const variance = o.totalCost.minus(outputCost);

        return {
          orderNumber: o.orderNumber,
          itemSku: o.item.sku,
          itemName: o.item.name,
          plannedQuantity: o.plannedQuantity,
          producedQuantity: o.producedQuantity,
          scrapQuantity: o.scrapQuantity,
          actualCost: o.totalCost,
          absorbedCost: outputCost,
          varianceAmount: variance,
          isFavorable: variance.lessThanOrEqualTo(0),
        };
      }),
    };
  }
}
