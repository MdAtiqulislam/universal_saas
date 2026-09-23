import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningReportsQueryDto } from './dto/planning-query.dto';
import { PlannedOrderAction, Prisma } from '@prisma/client';

@Injectable()
export class PlanningReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * MRP Summary Report.
   */
  async getSummary(organizationId: string, query: PlanningReportsQueryDto) {
    const where: Prisma.PlanningResultWhereInput = { organizationId };

    if (query.planningRunId) where.planningRunId = query.planningRunId;
    if (query.itemId) where.itemId = query.itemId;
    if (query.locationId) where.locationId = query.locationId;

    const results = await this.prisma.planningResult.findMany({
      where,
      include: { item: true, location: true, planningRun: true },
    });

    const totalGrossDemand = results.reduce(
      (sum, r) => sum.plus(r.grossRequirement),
      new Prisma.Decimal(0),
    );
    const totalAvailableSupply = results.reduce(
      (sum, r) => sum.plus(r.availableQuantity),
      new Prisma.Decimal(0),
    );
    const totalExpectedSupply = results.reduce(
      (sum, r) => sum.plus(r.expectedSupplyQuantity),
      new Prisma.Decimal(0),
    );
    const totalSafetyStock = results.reduce(
      (sum, r) => sum.plus(r.safetyStockQuantity),
      new Prisma.Decimal(0),
    );
    const totalNetRequirement = results.reduce(
      (sum, r) => sum.plus(r.netRequirement),
      new Prisma.Decimal(0),
    );

    const purchaseRecommendations = results.filter(
      (r) => r.suggestedAction === PlannedOrderAction.PURCHASE,
    ).length;

    const productionRecommendations = results.filter(
      (r) => r.suggestedAction === PlannedOrderAction.PRODUCTION,
    ).length;

    const shortageCount = results.filter(
      (r) =>
        r.plannedOrderDate &&
        new Date(r.plannedOrderDate).getTime() < new Date().getTime(),
    ).length;

    return {
      runCount: new Set(results.map((r) => r.planningRunId)).size,
      itemCount: results.length,
      totalGrossDemand,
      totalAvailableSupply,
      totalExpectedSupply,
      totalSafetyStock,
      totalNetRequirement,
      purchaseRecommendations,
      productionRecommendations,
      shortageCount,
      results,
    };
  }

  /**
   * Material Requirements Detailed Report.
   */
  async getMaterialRequirements(
    organizationId: string,
    query: PlanningReportsQueryDto,
  ) {
    const where: Prisma.PlanningResultWhereInput = { organizationId };

    if (query.planningRunId) where.planningRunId = query.planningRunId;
    if (query.itemId) where.itemId = query.itemId;

    return this.prisma.planningResult.findMany({
      where,
      include: { item: true, variant: true, location: true, planningRun: true },
      orderBy: [{ requiredDate: 'asc' }, { netRequirement: 'desc' }],
    });
  }

  /**
   * Supply / Demand Chronological Report.
   */
  async getSupplyDemand(
    organizationId: string,
    query: PlanningReportsQueryDto,
  ) {
    const demandWhere: Prisma.PlanningDemandWhereInput = { organizationId };
    const supplyWhere: Prisma.PlanningSupplyWhereInput = { organizationId };

    if (query.planningRunId) {
      demandWhere.planningRunId = query.planningRunId;
      supplyWhere.planningRunId = query.planningRunId;
    }
    if (query.itemId) {
      demandWhere.itemId = query.itemId;
      supplyWhere.itemId = query.itemId;
    }

    const [demands, supplies] = await Promise.all([
      this.prisma.planningDemand.findMany({
        where: demandWhere,
        include: { item: true, location: true },
        orderBy: { requiredDate: 'asc' },
      }),
      this.prisma.planningSupply.findMany({
        where: supplyWhere,
        include: { item: true, location: true },
        orderBy: { availableDate: 'asc' },
      }),
    ]);

    return {
      demands,
      supplies,
      totalDemandQuantity: demands.reduce(
        (sum, d) => sum.plus(d.quantity),
        new Prisma.Decimal(0),
      ),
      totalSupplyQuantity: supplies.reduce(
        (sum, s) => sum.plus(s.quantity),
        new Prisma.Decimal(0),
      ),
    };
  }

  /**
   * Shortages and Critical Planning Exceptions Report.
   */
  async getShortages(organizationId: string, query: PlanningReportsQueryDto) {
    const where: Prisma.PlannedOrderWhereInput = {
      organizationId,
      plannedOrderDate: { lt: new Date() }, // Past-due order date = shortage
    };

    if (query.planningRunId) where.planningRunId = query.planningRunId;
    if (query.itemId) where.itemId = query.itemId;

    return this.prisma.plannedOrder.findMany({
      where,
      include: { item: true, supplier: true, bom: true, planningRun: true },
      orderBy: { requiredDate: 'asc' },
    });
  }
}
