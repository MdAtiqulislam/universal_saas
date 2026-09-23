import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BalancesService } from '../inventory/balances/balances.service';
import { InventoryCostLayersService } from '../inventory/costing/inventory-cost-layers.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { IssueMaterialDto } from './dto/issue-material.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';
import {
  ProductionOrderStatus,
  ProductionLineStatus,
  StockMovementType,
  JournalEntryStatus,
  FiscalPeriodStatus,
  SerialStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ProductionExecutionService {
  private readonly logger = new Logger(ProductionExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly balancesService: BalancesService,
    private readonly costLayersService: InventoryCostLayersService,
    private readonly configService: ManufacturingConfigService,
  ) {}

  /**
   * Issue raw materials and components to a production order.
   */
  async issueMaterial(
    organizationId: string,
    productionOrderId: string,
    dto: IssueMaterialDto,
    userId: string,
  ) {
    if (dto.quantity <= 0) {
      throw new BadRequestException(
        'Issue quantity must be strictly positive.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: productionOrderId, organizationId },
        include: { lines: true },
      });

      if (!order) {
        throw new NotFoundException(
          `Production order with ID ${productionOrderId} not found.`,
        );
      }

      if (
        order.status !== ProductionOrderStatus.RELEASED &&
        order.status !== ProductionOrderStatus.IN_PROGRESS &&
        order.status !== ProductionOrderStatus.PARTIALLY_COMPLETED
      ) {
        throw new BadRequestException(
          `Cannot issue material to production order in status ${order.status}. Must be RELEASED, IN_PROGRESS, or PARTIALLY_COMPLETED.`,
        );
      }

      const line = order.lines.find((l) => l.id === dto.productionOrderLineId);
      if (!line) {
        throw new NotFoundException(
          `Production order line ${dto.productionOrderLineId} not found in this production order.`,
        );
      }

      const issueQty = new Prisma.Decimal(dto.quantity);
      const locationId = dto.locationId ?? order.locationId;

      // 1. Consume FIFO cost layers to determine exact material valuation
      const fifoResult = await this.costLayersService.consumeFifo(
        organizationId,
        {
          itemId: line.itemId,
          variantId: line.variantId ?? null,
          locationId,
          quantity: issueQty,
        },
        tx,
      );

      const totalIssueCost = fifoResult.totalCost.isZero()
        ? line.unitCost.mul(issueQty)
        : fifoResult.totalCost;
      const unitIssueCost = issueQty.isZero()
        ? new Prisma.Decimal(0)
        : totalIssueCost.div(issueQty);

      // 2. Handle serial tracking if applicable
      let serialId = dto.serialId;
      if (dto.serialNumbers && dto.serialNumbers.length > 0) {
        const serialRecord = await tx.inventorySerial.findFirst({
          where: {
            organizationId,
            itemId: line.itemId,
            serialNumber: dto.serialNumbers[0],
            status: SerialStatus.AVAILABLE,
          },
        });
        if (!serialRecord) {
          throw new BadRequestException(
            `Serial number ${dto.serialNumbers[0]} is not available in inventory.`,
          );
        }
        serialId = serialRecord.id;
        await tx.inventorySerial.update({
          where: { id: serialId },
          data: { status: SerialStatus.TRANSFERRED },
        });
      }

      // 3. Mutate physical stock balance (movementType: ISSUE)
      const stockMovement = await this.balancesService.applyStockMovement(
        organizationId,
        {
          itemId: line.itemId,
          variantId: line.variantId ?? null,
          locationId,
          movementType: StockMovementType.ISSUE,
          quantity: Number(issueQty),
          batchId: dto.batchId ?? null,
          serialId: serialId ?? null,
          referenceType: 'PRODUCTION_ORDER',
          referenceId: order.orderNumber,
          reason: `Material issue for Production Order ${order.orderNumber}`,
        },
        userId,
        tx,
      );

      // 4. Record ProductionMaterialIssue
      const materialIssue = await tx.productionMaterialIssue.create({
        data: {
          organizationId,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          itemId: line.itemId,
          variantId: line.variantId ?? null,
          locationId,
          quantity: issueQty,
          unitCost: unitIssueCost,
          totalCost: totalIssueCost,
          batchId: dto.batchId ?? null,
          serialId: serialId ?? null,
          stockMovementId: stockMovement.movement.id,
          createdByUserId: userId,
        },
      });

      // 5. Update ProductionOrderLine
      const newIssuedQty = line.issuedQuantity.plus(issueQty);
      const newConsumedQty = line.consumedQuantity.plus(issueQty);
      const newLineTotalCost = line.totalCost.plus(totalIssueCost);
      const newLineUnitCost = newConsumedQty.isZero()
        ? new Prisma.Decimal(0)
        : newLineTotalCost.div(newConsumedQty);
      const newLineStatus = newIssuedQty.greaterThanOrEqualTo(
        line.requiredQuantity,
      )
        ? ProductionLineStatus.FULLY_ISSUED
        : ProductionLineStatus.PARTIALLY_ISSUED;

      await tx.productionOrderLine.update({
        where: { id: line.id },
        data: {
          issuedQuantity: newIssuedQty,
          consumedQuantity: newConsumedQty,
          unitCost: newLineUnitCost,
          totalCost: newLineTotalCost,
          status: newLineStatus,
        },
      });

      // 6. Update ProductionOrder aggregate
      const newMaterialCost = order.materialCost.plus(totalIssueCost);
      const newTotalCost = newMaterialCost
        .plus(order.laborCost)
        .plus(order.overheadCost);

      const nextStatus =
        order.status === ProductionOrderStatus.RELEASED
          ? ProductionOrderStatus.IN_PROGRESS
          : order.status;

      let issueJournalId = order.issueJournalEntryId;

      // 7. General Ledger Posting for WIP Material Issuance
      const config = await tx.manufacturingConfiguration.findUnique({
        where: { organizationId },
      });

      if (
        config?.wipAccountId &&
        config?.rawMaterialAccountId &&
        totalIssueCost.greaterThan(0)
      ) {
        const period = await tx.fiscalPeriod.findFirst({
          where: {
            organizationId,
            status: FiscalPeriodStatus.OPEN,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        });

        if (period) {
          let journalNumber: string;
          try {
            const seq = await this.numberingService.nextNumber(
              organizationId,
              'JOURNAL_ENTRY',
              userId,
            );
            journalNumber = seq.formatted;
          } catch {
            const count = await tx.journalEntry.count({
              where: { organizationId },
            });
            journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
          }

          const journal = await tx.journalEntry.create({
            data: {
              organizationId,
              fiscalPeriodId: period.id,
              entryNumber: journalNumber,
              entryDate: new Date(),
              description: `WIP Material Issue - Production Order ${order.orderNumber}`,
              status: JournalEntryStatus.POSTED,
              sourceType: 'PRODUCTION_ORDER',
              sourceId: order.id,
              createdByUserId: userId,
              postedAt: new Date(),
              postedByUserId: userId,
              lines: {
                create: [
                  {
                    organization: { connect: { id: organizationId } },
                    account: { connect: { id: config.wipAccountId } },
                    debit: totalIssueCost,
                    credit: new Prisma.Decimal(0),
                    lineNumber: 1,
                    description: `Debit WIP Inventory for MO ${order.orderNumber}`,
                  },
                  {
                    organization: { connect: { id: organizationId } },
                    account: { connect: { id: config.rawMaterialAccountId } },
                    debit: new Prisma.Decimal(0),
                    credit: totalIssueCost,
                    lineNumber: 2,
                    description: `Credit Raw Material Inventory for MO ${order.orderNumber}`,
                  },
                ],
              },
            },
          });

          issueJournalId = journal.id;
        }
      }

      const updatedOrder = await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          materialCost: newMaterialCost,
          totalCost: newTotalCost,
          status: nextStatus,
          actualStartDate: order.actualStartDate ?? new Date(),
          issueJournalEntryId: issueJournalId,
        },
        include: { lines: true, materialIssues: true },
      });

      await this.eventBus.publish({
        eventName: 'PRODUCTION_MATERIAL_ISSUED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'manufacturing.order.issue',
        resource: 'production_order',
        resourceId: order.id,
        details: {
          orderNumber: order.orderNumber,
          lineId: line.id,
          quantity: Number(issueQty),
          totalCost: Number(totalIssueCost),
        },
      });

      return {
        materialIssue,
        order: updatedOrder,
      };
    });
  }

  /**
   * Complete production order (full or partial finished goods receipt).
   */
  async complete(
    organizationId: string,
    productionOrderId: string,
    dto: CompleteProductionDto,
    userId: string,
  ) {
    if (dto.quantity <= 0) {
      throw new BadRequestException(
        'Completion quantity must be strictly positive.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: productionOrderId, organizationId },
        include: { lines: true, outputs: true },
      });

      if (!order) {
        throw new NotFoundException(
          `Production order with ID ${productionOrderId} not found.`,
        );
      }

      if (
        order.status !== ProductionOrderStatus.IN_PROGRESS &&
        order.status !== ProductionOrderStatus.PARTIALLY_COMPLETED
      ) {
        throw new BadRequestException(
          `Cannot complete production order in status ${order.status}. Must be IN_PROGRESS or PARTIALLY_COMPLETED.`,
        );
      }

      const produceQty = new Prisma.Decimal(dto.quantity);
      const scrapQty = new Prisma.Decimal(dto.scrapQuantity ?? 0);
      const locationId = dto.locationId ?? order.locationId;

      const laborCostAdd = new Prisma.Decimal(dto.laborCost ?? 0);
      const overheadCostAdd = new Prisma.Decimal(dto.overheadCost ?? 0);

      // Calculate unit & total production cost for this output batch
      // Material cost proportion = (materialCost / plannedQty) * produceQty
      const plannedQty = order.plannedQuantity.isZero()
        ? new Prisma.Decimal(1)
        : order.plannedQuantity;
      const materialPortion = order.materialCost
        .mul(produceQty)
        .div(plannedQty);
      const outputTotalCost = materialPortion
        .plus(laborCostAdd)
        .plus(overheadCostAdd);
      const outputUnitCost = produceQty.isZero()
        ? new Prisma.Decimal(0)
        : outputTotalCost.div(produceQty);

      // 1. Batch handling if batch number provided
      let batchId: string | null = null;
      if (dto.batchNumber) {
        let batch = await tx.inventoryBatch.findFirst({
          where: {
            organizationId,
            itemId: order.itemId,
            batchNumber: dto.batchNumber,
            locationId,
          },
        });
        if (!batch) {
          batch = await tx.inventoryBatch.create({
            data: {
              organizationId,
              itemId: order.itemId,
              variantId: order.variantId ?? null,
              locationId,
              batchNumber: dto.batchNumber,
              manufacturedAt: new Date(),
              quantity: produceQty,
            },
          });
        } else {
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: { quantity: batch.quantity.plus(produceQty) },
          });
        }
        batchId = batch.id;
      }

      // 2. Serial handling if serial numbers provided
      let serialId: string | null = null;
      if (dto.serialNumbers && dto.serialNumbers.length > 0) {
        for (const sn of dto.serialNumbers) {
          const serial = await tx.inventorySerial.create({
            data: {
              organizationId,
              itemId: order.itemId,
              variantId: order.variantId ?? null,
              locationId,
              serialNumber: sn,
              status: SerialStatus.AVAILABLE,
            },
          });
          if (!serialId) serialId = serial.id;
        }
      }

      // 3. Receive finished goods inventory (movementType: RECEIPT)
      const stockMovement = await this.balancesService.applyStockMovement(
        organizationId,
        {
          itemId: order.itemId,
          variantId: order.variantId ?? null,
          locationId,
          movementType: StockMovementType.RECEIPT,
          quantity: Number(produceQty),
          batchId,
          serialId,
          referenceType: 'PRODUCTION_ORDER',
          referenceId: order.orderNumber,
          reason: `Finished goods receipt from Production Order ${order.orderNumber}`,
        },
        userId,
        tx,
      );

      // 4. Inbound M19 Cost Layer creation for finished goods
      await this.costLayersService.createLayer(
        organizationId,
        {
          itemId: order.itemId,
          variantId: order.variantId ?? null,
          locationId,
          batchId,
          receiptQuantity: produceQty,
          unitCost: outputUnitCost,
          sourceDocument: 'PRODUCTION_ORDER',
          sourceDocumentId: order.id,
        },
        tx,
      );

      // 5. Record ProductionOutput
      const output = await tx.productionOutput.create({
        data: {
          organizationId,
          productionOrderId: order.id,
          itemId: order.itemId,
          variantId: order.variantId ?? null,
          locationId,
          quantity: produceQty,
          scrapQuantity: scrapQty,
          unitCost: outputUnitCost,
          totalCost: outputTotalCost,
          batchId,
          serialId,
          stockMovementId: stockMovement.movement.id,
          createdByUserId: userId,
        },
      });

      // 6. Update ProductionOrder aggregate
      const newProducedQty = order.producedQuantity.plus(produceQty);
      const newScrapQty = order.scrapQuantity.plus(scrapQty);
      const newLaborCost = order.laborCost.plus(laborCostAdd);
      const newOverheadCost = order.overheadCost.plus(overheadCostAdd);
      const newTotalCost = order.materialCost
        .plus(newLaborCost)
        .plus(newOverheadCost);
      const newUnitCost = newProducedQty.isZero()
        ? new Prisma.Decimal(0)
        : newTotalCost.div(newProducedQty);

      const isFullyCompleted = newProducedQty.greaterThanOrEqualTo(
        order.plannedQuantity,
      );
      const nextStatus = isFullyCompleted
        ? ProductionOrderStatus.COMPLETED
        : ProductionOrderStatus.PARTIALLY_COMPLETED;

      let completionJournalId = order.completionJournalEntryId;

      // 7. General Ledger Posting for Finished Goods Receipt
      const config = await tx.manufacturingConfiguration.findUnique({
        where: { organizationId },
      });

      if (
        config?.finishedGoodsAccountId &&
        config?.wipAccountId &&
        outputTotalCost.greaterThan(0)
      ) {
        const period = await tx.fiscalPeriod.findFirst({
          where: {
            organizationId,
            status: FiscalPeriodStatus.OPEN,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        });

        if (period) {
          let journalNumber: string;
          try {
            const seq = await this.numberingService.nextNumber(
              organizationId,
              'JOURNAL_ENTRY',
              userId,
            );
            journalNumber = seq.formatted;
          } catch {
            const count = await tx.journalEntry.count({
              where: { organizationId },
            });
            journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
          }

          let lineNum = 1;
          const journalLines: Prisma.JournalLineCreateWithoutJournalEntryInput[] =
            [
              {
                organization: { connect: { id: organizationId } },
                account: { connect: { id: config.finishedGoodsAccountId } },
                debit: outputTotalCost,
                credit: new Prisma.Decimal(0),
                lineNumber: lineNum++,
                description: `Debit Finished Goods Inventory for MO ${order.orderNumber}`,
              },
              {
                organization: { connect: { id: organizationId } },
                account: { connect: { id: config.wipAccountId } },
                debit: new Prisma.Decimal(0),
                credit: materialPortion,
                lineNumber: lineNum++,
                description: `Credit WIP Inventory for MO ${order.orderNumber}`,
              },
            ];

          let wipCredit = materialPortion;
          if (laborCostAdd.greaterThan(0) && config.laborAccountId) {
            journalLines.push({
              organization: { connect: { id: organizationId } },
              account: { connect: { id: config.laborAccountId } },
              debit: new Prisma.Decimal(0),
              credit: laborCostAdd,
              lineNumber: lineNum++,
              description: `Credit Direct Labor Applied for MO ${order.orderNumber}`,
            });
          } else if (laborCostAdd.greaterThan(0)) {
            wipCredit = wipCredit.plus(laborCostAdd);
          }

          if (overheadCostAdd.greaterThan(0) && config.overheadAccountId) {
            journalLines.push({
              organization: { connect: { id: organizationId } },
              account: { connect: { id: config.overheadAccountId } },
              debit: new Prisma.Decimal(0),
              credit: overheadCostAdd,
              lineNumber: lineNum++,
              description: `Credit Manufacturing Overhead Applied for MO ${order.orderNumber}`,
            });
          } else if (overheadCostAdd.greaterThan(0)) {
            wipCredit = wipCredit.plus(overheadCostAdd);
          }

          journalLines[1].credit = wipCredit;

          const journal = await tx.journalEntry.create({
            data: {
              organizationId,
              fiscalPeriodId: period.id,
              entryNumber: journalNumber,
              entryDate: new Date(),
              description: `Finished Goods Receipt - Production Order ${order.orderNumber}`,
              status: JournalEntryStatus.POSTED,
              sourceType: 'PRODUCTION_ORDER',
              sourceId: order.id,
              createdByUserId: userId,
              postedAt: new Date(),
              postedByUserId: userId,
              lines: { create: journalLines },
            },
          });

          completionJournalId = journal.id;
        }
      }

      const updatedOrder = await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          producedQuantity: newProducedQty,
          scrapQuantity: newScrapQty,
          laborCost: newLaborCost,
          overheadCost: newOverheadCost,
          totalCost: newTotalCost,
          unitCost: newUnitCost,
          status: nextStatus,
          completedByUserId: isFullyCompleted
            ? userId
            : order.completedByUserId,
          actualCompletionDate: isFullyCompleted
            ? new Date()
            : order.actualCompletionDate,
          completionJournalEntryId: completionJournalId,
        },
        include: { lines: true, outputs: true },
      });

      await this.eventBus.publish({
        eventName: 'PRODUCTION_COMPLETED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'manufacturing.order.complete',
        resource: 'production_order',
        resourceId: order.id,
        details: {
          orderNumber: order.orderNumber,
          producedQuantity: Number(newProducedQty),
          status: nextStatus,
        },
      });

      return {
        output,
        order: updatedOrder,
      };
    });
  }

  /**
   * Close production order and reconcile any manufacturing variance.
   */
  async close(
    organizationId: string,
    productionOrderId: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: productionOrderId, organizationId },
        include: { lines: true, outputs: true },
      });

      if (!order) {
        throw new NotFoundException(
          `Production order with ID ${productionOrderId} not found.`,
        );
      }

      if (
        order.status !== ProductionOrderStatus.COMPLETED &&
        order.status !== ProductionOrderStatus.PARTIALLY_COMPLETED
      ) {
        throw new BadRequestException(
          `Cannot close production order in status ${order.status}. Must be COMPLETED or PARTIALLY_COMPLETED.`,
        );
      }

      // Calculate unabsorbed material variance (Material Cost issued vs Material Cost recognized in completed goods)
      const totalOutputsCost = order.outputs.reduce(
        (sum, out) => sum.plus(out.totalCost),
        new Prisma.Decimal(0),
      );
      const varianceAmount = order.totalCost.minus(totalOutputsCost);

      let varianceJournalId = order.varianceJournalEntryId;

      if (!varianceAmount.isZero()) {
        const config = await tx.manufacturingConfiguration.findUnique({
          where: { organizationId },
        });

        if (config?.varianceAccountId && config?.wipAccountId) {
          const period = await tx.fiscalPeriod.findFirst({
            where: {
              organizationId,
              status: FiscalPeriodStatus.OPEN,
              startDate: { lte: new Date() },
              endDate: { gte: new Date() },
            },
          });

          if (period) {
            let journalNumber: string;
            try {
              const seq = await this.numberingService.nextNumber(
                organizationId,
                'JOURNAL_ENTRY',
                userId,
              );
              journalNumber = seq.formatted;
            } catch {
              const count = await tx.journalEntry.count({
                where: { organizationId },
              });
              journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
            }

            const isDebitVariance = varianceAmount.greaterThan(0);
            const absVariance = varianceAmount.abs();

            const journal = await tx.journalEntry.create({
              data: {
                organizationId,
                fiscalPeriodId: period.id,
                entryNumber: journalNumber,
                entryDate: new Date(),
                description: `Production Variance - Order ${order.orderNumber}`,
                status: JournalEntryStatus.POSTED,
                sourceType: 'PRODUCTION_ORDER',
                sourceId: order.id,
                createdByUserId: userId,
                postedAt: new Date(),
                postedByUserId: userId,
                lines: {
                  create: [
                    {
                      organization: { connect: { id: organizationId } },
                      account: { connect: { id: config.varianceAccountId } },
                      debit: isDebitVariance
                        ? absVariance
                        : new Prisma.Decimal(0),
                      credit: isDebitVariance
                        ? new Prisma.Decimal(0)
                        : absVariance,
                      lineNumber: 1,
                      description: `Production Variance for MO ${order.orderNumber}`,
                    },
                    {
                      organization: { connect: { id: organizationId } },
                      account: { connect: { id: config.wipAccountId } },
                      debit: isDebitVariance
                        ? new Prisma.Decimal(0)
                        : absVariance,
                      credit: isDebitVariance
                        ? absVariance
                        : new Prisma.Decimal(0),
                      lineNumber: 2,
                      description: `WIP Variance Offset for MO ${order.orderNumber}`,
                    },
                  ],
                },
              },
            });

            varianceJournalId = journal.id;

            await this.eventBus.publish({
              eventName: 'PRODUCTION_VARIANCE_RECORDED',
              occurredAt: new Date(),
              organizationId,
              actorUserId: userId,
              action: 'manufacturing.order.variance',
              resource: 'production_order',
              resourceId: order.id,
              details: {
                orderNumber: order.orderNumber,
                varianceAmount: Number(varianceAmount),
              },
            });
          }
        }
      }

      const updated = await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          status: ProductionOrderStatus.CLOSED,
          closedByUserId: userId,
          varianceJournalEntryId: varianceJournalId,
        },
        include: { lines: true, outputs: true },
      });

      await this.eventBus.publish({
        eventName: 'PRODUCTION_CLOSED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'manufacturing.order.close',
        resource: 'production_order',
        resourceId: order.id,
        details: { orderNumber: updated.orderNumber },
      });

      return updated;
    });
  }
}
