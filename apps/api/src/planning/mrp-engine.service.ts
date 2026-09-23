import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PlanningConfigService } from './planning-config.service';
import { BomExplosionService } from './bom-explosion.service';
import {
  PlanningDemandSource,
  PlanningSupplySource,
  PlannedOrderAction,
  PlannedOrderStatus,
  SalesOrderStatus,
  PurchaseOrderStatus,
  ProductionOrderStatus,
  BomStatus,
  Prisma,
} from '@prisma/client';

export interface MrpExecutionContext {
  planningRunId: string;
  organizationId: string;
  startDate: Date;
  endDate: Date;
  locationId?: string | null;
  itemId?: string | null;
  includeSalesOrders: boolean;
  includeProductionOrders: boolean;
  includeSafetyStock: boolean;
  userId: string;
}

export interface MrpCalculationOutput {
  demandSnapshots: Prisma.PlanningDemandCreateManyInput[];
  supplySnapshots: Prisma.PlanningSupplyCreateManyInput[];
  planningResults: Prisma.PlanningResultCreateManyInput[];
  plannedOrders: Prisma.PlannedOrderCreateManyInput[];
  totalShortages: number;
}

@Injectable()
export class MrpEngineService {
  private readonly logger = new Logger(MrpEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly configService: PlanningConfigService,
    private readonly bomExplosionService: BomExplosionService,
  ) {}

  /**
   * Execute core MRP calculation for a planning run within transaction.
   */
  async executeCalculation(
    ctx: MrpExecutionContext,
    tx: Prisma.TransactionClient,
  ): Promise<MrpCalculationOutput> {
    const demandSnapshots: Prisma.PlanningDemandCreateManyInput[] = [];
    const supplySnapshots: Prisma.PlanningSupplyCreateManyInput[] = [];
    const planningResults: Prisma.PlanningResultCreateManyInput[] = [];
    const plannedOrders: Prisma.PlannedOrderCreateManyInput[] = [];

    let totalShortages = 0;

    // 1. COLLECT DEMAND SOURCES
    // ----------------------------------------------------

    // A. Confirmed / Open Sales Orders (M11)
    if (ctx.includeSalesOrders) {
      const soWhere: Prisma.SalesOrderWhereInput = {
        organizationId: ctx.organizationId,
        status: {
          in: [
            SalesOrderStatus.CONFIRMED,
            SalesOrderStatus.PARTIALLY_RESERVED,
            SalesOrderStatus.RESERVED,
            SalesOrderStatus.PARTIALLY_DELIVERED,
          ],
        },
      };

      if (ctx.locationId) soWhere.locationId = ctx.locationId;

      const salesOrders = await tx.salesOrder.findMany({
        where: soWhere,
        include: {
          lines: {
            where: ctx.itemId ? { itemId: ctx.itemId } : undefined,
          },
        },
      });

      for (const so of salesOrders) {
        for (const line of so.lines) {
          const remainingQty = new Prisma.Decimal(line.quantity).minus(
            new Prisma.Decimal(line.quantityDelivered),
          );

          if (remainingQty.greaterThan(0)) {
            const reqDate = so.expectedDeliveryDate ?? so.orderDate;
            demandSnapshots.push({
              planningRunId: ctx.planningRunId,
              organizationId: ctx.organizationId,
              sourceType: PlanningDemandSource.SALES_ORDER,
              sourceId: so.id,
              sourceNumber: so.orderNumber,
              itemId: line.itemId,
              variantId: line.variantId,
              locationId: so.locationId,
              requiredDate: reqDate,
              quantity: remainingQty,
              uomId: null,
            });
          }
        }
      }
    }

    // B. Active Production Orders (M25) - Component Demand
    if (ctx.includeProductionOrders) {
      const moWhere: Prisma.ProductionOrderWhereInput = {
        organizationId: ctx.organizationId,
        status: {
          in: [
            ProductionOrderStatus.RELEASED,
            ProductionOrderStatus.IN_PROGRESS,
            ProductionOrderStatus.PARTIALLY_COMPLETED,
          ],
        },
      };

      if (ctx.locationId) moWhere.locationId = ctx.locationId;

      const productionOrders = await tx.productionOrder.findMany({
        where: moWhere,
        include: {
          lines: {
            where: ctx.itemId ? { itemId: ctx.itemId } : undefined,
          },
        },
      });

      for (const mo of productionOrders) {
        for (const line of mo.lines) {
          const remainingRequired = new Prisma.Decimal(
            line.requiredQuantity,
          ).minus(new Prisma.Decimal(line.issuedQuantity));

          if (remainingRequired.greaterThan(0)) {
            demandSnapshots.push({
              planningRunId: ctx.planningRunId,
              organizationId: ctx.organizationId,
              sourceType: PlanningDemandSource.PRODUCTION_ORDER,
              sourceId: mo.id,
              sourceNumber: mo.orderNumber,
              itemId: line.itemId,
              variantId: line.variantId,
              locationId: mo.locationId,
              requiredDate: mo.plannedStartDate,
              quantity: remainingRequired,
              uomId: line.uomId,
            });
          }
        }
      }
    }

    // 2. COLLECT SUPPLY SOURCES
    // ----------------------------------------------------

    // A. Authoritative On-Hand & Available Inventory (M09)
    const balanceWhere: Prisma.InventoryBalanceWhereInput = {
      organizationId: ctx.organizationId,
    };
    if (ctx.locationId) balanceWhere.locationId = ctx.locationId;
    if (ctx.itemId) balanceWhere.itemId = ctx.itemId;

    const balances = await tx.inventoryBalance.findMany({
      where: balanceWhere,
    });

    for (const bal of balances) {
      const available = new Prisma.Decimal(bal.quantityOnHand).minus(
        new Prisma.Decimal(bal.quantityReserved),
      );

      if (available.greaterThan(0)) {
        supplySnapshots.push({
          planningRunId: ctx.planningRunId,
          organizationId: ctx.organizationId,
          sourceType: PlanningSupplySource.ON_HAND,
          sourceId: bal.id,
          sourceNumber: 'INVENTORY_ON_HAND',
          itemId: bal.itemId,
          variantId: bal.variantId,
          locationId: bal.locationId,
          availableDate: new Date(),
          quantity: available,
          uomId: null,
        });
      }
    }

    // B. Open Purchase Orders (M10) - Expected Supply
    const poWhere: Prisma.PurchaseOrderWhereInput = {
      organizationId: ctx.organizationId,
      status: {
        in: [
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
        ],
      },
    };
    if (ctx.locationId) poWhere.locationId = ctx.locationId;

    const purchaseOrders = await tx.purchaseOrder.findMany({
      where: poWhere,
      include: {
        lines: {
          where: ctx.itemId ? { itemId: ctx.itemId } : undefined,
        },
      },
    });

    for (const po of purchaseOrders) {
      for (const line of po.lines) {
        const openQty = new Prisma.Decimal(line.quantity).minus(
          new Prisma.Decimal(line.receivedQuantity),
        );

        if (openQty.greaterThan(0)) {
          const availDate = po.expectedDate ?? new Date();
          supplySnapshots.push({
            planningRunId: ctx.planningRunId,
            organizationId: ctx.organizationId,
            sourceType: PlanningSupplySource.PURCHASE_ORDER,
            sourceId: po.id,
            sourceNumber: po.poNumber,
            itemId: line.itemId,
            variantId: line.variantId,
            locationId: po.locationId,
            availableDate: availDate,
            quantity: openQty,
            uomId: null,
          });
        }
      }
    }

    // C. Open Production Orders (M25) - Expected Finished Goods Supply
    const moSupplyWhere: Prisma.ProductionOrderWhereInput = {
      organizationId: ctx.organizationId,
      status: {
        in: [
          ProductionOrderStatus.RELEASED,
          ProductionOrderStatus.IN_PROGRESS,
          ProductionOrderStatus.PARTIALLY_COMPLETED,
        ],
      },
    };
    if (ctx.locationId) moSupplyWhere.locationId = ctx.locationId;
    if (ctx.itemId) moSupplyWhere.itemId = ctx.itemId;

    const openMoSupplies = await tx.productionOrder.findMany({
      where: moSupplyWhere,
    });

    for (const mo of openMoSupplies) {
      const remainingOutput = new Prisma.Decimal(mo.plannedQuantity).minus(
        new Prisma.Decimal(mo.producedQuantity),
      );

      if (remainingOutput.greaterThan(0)) {
        supplySnapshots.push({
          planningRunId: ctx.planningRunId,
          organizationId: ctx.organizationId,
          sourceType: PlanningSupplySource.PRODUCTION_ORDER,
          sourceId: mo.id,
          sourceNumber: mo.orderNumber,
          itemId: mo.itemId,
          variantId: mo.variantId,
          locationId: mo.locationId,
          availableDate: mo.plannedCompletionDate,
          quantity: remainingOutput,
          uomId: null,
        });
      }
    }

    // 3. MULTI-LEVEL BOM EXPLOSION & NET REQUIREMENTS CALCULATION
    // ----------------------------------------------------

    // Group initial demands by Item ID + Location ID
    const demandItems = new Set<string>();
    for (const d of demandSnapshots) {
      demandItems.add(d.itemId);
    }

    // Explode BOM for any manufactured demand item
    const explodedComponentDemands: Prisma.PlanningDemandCreateManyInput[] = [];
    for (const d of demandSnapshots) {
      const exploded = await this.bomExplosionService.explode(
        ctx.organizationId,
        d.itemId,
        new Prisma.Decimal(d.quantity as unknown as Prisma.Decimal.Value),
        d.variantId,
      );

      for (const exp of exploded) {
        explodedComponentDemands.push({
          planningRunId: ctx.planningRunId,
          organizationId: ctx.organizationId,
          sourceType: PlanningDemandSource.PRODUCTION_ORDER,
          sourceId: d.sourceId,
          sourceNumber: `BOM:${exp.bomNumber} (L${exp.level})`,
          itemId: exp.itemId,
          variantId: exp.variantId,
          locationId: d.locationId,
          requiredDate: d.requiredDate,
          quantity: exp.requiredQuantity,
          uomId: exp.uomId,
        });
        demandItems.add(exp.itemId);
      }
    }

    // Merge exploded demands into total demands
    const allDemands = [...demandSnapshots, ...explodedComponentDemands];

    // Evaluate each planned item
    let planOrderCounter = 1;

    for (const itemId of demandItems) {
      const profile = await this.configService.getItemProfile(
        ctx.organizationId,
        itemId,
      );

      // Check if item is manufactured (has active BOM)
      const activeBom = await tx.billOfMaterial.findFirst({
        where: {
          organizationId: ctx.organizationId,
          itemId,
          status: BomStatus.ACTIVE,
        },
      });

      // Filter demands for this item
      const itemDemands = allDemands.filter((d) => d.itemId === itemId);
      const grossDemand = itemDemands.reduce(
        (sum, d) =>
          sum.plus(
            new Prisma.Decimal(d.quantity as unknown as Prisma.Decimal.Value),
          ),
        new Prisma.Decimal(0),
      );

      // Filter supplies for this item
      const itemSupplies = supplySnapshots.filter((s) => s.itemId === itemId);
      const onHandSupply = itemSupplies
        .filter((s) => s.sourceType === PlanningSupplySource.ON_HAND)
        .reduce(
          (sum, s) =>
            sum.plus(
              new Prisma.Decimal(s.quantity as unknown as Prisma.Decimal.Value),
            ),
          new Prisma.Decimal(0),
        );

      const expectedSupply = itemSupplies
        .filter((s) => s.sourceType !== PlanningSupplySource.ON_HAND)
        .reduce(
          (sum, s) =>
            sum.plus(
              new Prisma.Decimal(s.quantity as unknown as Prisma.Decimal.Value),
            ),
          new Prisma.Decimal(0),
        );

      const safetyStock = ctx.includeSafetyStock
        ? new Prisma.Decimal(profile.safetyStock)
        : new Prisma.Decimal(0);

      // Available = OnHand (already net of reserved in supply collector)
      const available = onHandSupply;

      // Net Requirement = max(0, GrossDemand + SafetyStock - Available - ExpectedSupply)
      const netRequirementRaw = grossDemand
        .plus(safetyStock)
        .minus(available)
        .minus(expectedSupply);

      const netRequirement = netRequirementRaw.greaterThan(0)
        ? netRequirementRaw
        : new Prisma.Decimal(0);

      // Determine required date (earliest demand date)
      const earliestDemandDate =
        itemDemands.length > 0
          ? new Date(
              Math.min(
                ...itemDemands.map((d) => new Date(d.requiredDate).getTime()),
              ),
            )
          : new Date();

      // Action determination:
      let action: PlannedOrderAction = PlannedOrderAction.PURCHASE;
      if (activeBom) {
        action = PlannedOrderAction.PRODUCTION;
      }

      if (netRequirement.greaterThan(0)) {
        // Lot sizing calculations: MOQ and Order Multiples
        let suggestedQty = netRequirement;
        const moq = new Prisma.Decimal(
          (profile.minOrderQuantity ?? 1).toString(),
        );
        if (suggestedQty.lessThan(moq)) {
          suggestedQty = moq;
        }

        const multiple = new Prisma.Decimal(
          (profile.orderMultiple ?? 1).toString(),
        );
        if (multiple.greaterThan(1)) {
          const remainder = suggestedQty.modulo(multiple);
          if (!remainder.isZero()) {
            suggestedQty = suggestedQty.plus(multiple.minus(remainder));
          }
        }

        // Lead time date offsetting
        const leadDays = profile.leadTimeDays ?? 7;
        const plannedOrderDate = new Date(earliestDemandDate);
        plannedOrderDate.setDate(plannedOrderDate.getDate() - leadDays);

        const plannedReceiptDate = new Date(earliestDemandDate);

        // Check if plannedOrderDate is in the past (Shortage / Expedite exception)
        const isPastDue = plannedOrderDate.getTime() < new Date().getTime();
        if (isPastDue) {
          totalShortages++;
        }

        // Create PlanningResult record
        planningResults.push({
          planningRunId: ctx.planningRunId,
          organizationId: ctx.organizationId,
          itemId,
          variantId: null,
          locationId: ctx.locationId ?? null,
          grossRequirement: grossDemand,
          onHandQuantity: onHandSupply,
          reservedQuantity: new Prisma.Decimal(0),
          availableQuantity: available,
          expectedSupplyQuantity: expectedSupply,
          safetyStockQuantity: safetyStock,
          netRequirement,
          requiredDate: earliestDemandDate,
          suggestedAction: action,
          suggestedQuantity: suggestedQty,
          plannedOrderDate,
          plannedReceiptDate,
          explosionLevel: 0,
          sourceReferences: {
            demandCount: itemDemands.length,
            supplyCount: itemSupplies.length,
          },
        });

        // Generate PlannedOrder recommendation
        const orderNumber = `PLN-${String(planOrderCounter++).padStart(6, '0')}`;

        plannedOrders.push({
          planningRunId: ctx.planningRunId,
          organizationId: ctx.organizationId,
          orderNumber,
          action,
          itemId,
          variantId: null,
          locationId: ctx.locationId ?? null,
          quantity: suggestedQty,
          requiredDate: earliestDemandDate,
          plannedOrderDate,
          plannedReceiptDate,
          supplierId:
            action === PlannedOrderAction.PURCHASE
              ? profile.preferredSupplierId
              : null,
          bomId:
            action === PlannedOrderAction.PRODUCTION
              ? (profile.preferredBomId ?? activeBom?.id)
              : null,
          status: PlannedOrderStatus.SUGGESTED,
          reason: `MRP Generated: Net requirement ${netRequirement.toString()}${
            isPastDue ? ' (SHORTAGE / EXPEDITE NEEDED)' : ''
          }`,
          sourceDemandRef: `Run ${ctx.planningRunId}`,
        });
      }
    }

    return {
      demandSnapshots: allDemands,
      supplySnapshots,
      planningResults,
      plannedOrders,
      totalShortages,
    };
  }
}
