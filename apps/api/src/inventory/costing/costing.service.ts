import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { InventoryValuationService } from './inventory-valuation.service';
import { CogsService } from './cogs.service';
import { RecordReceiptCostDto } from './dto/record-receipt-cost.dto';
import { RecordIssueCogsDto } from './dto/record-issue-cogs.dto';
import { RecordAdjustmentCostDto } from './dto/record-adjustment-cost.dto';
import { RecordReturnRestockCostDto } from './dto/record-return-restock-cost.dto';
import { ValuationQueryDto } from './dto/valuation-query.dto';
import { ItemCostHistoryQueryDto } from './dto/item-cost-history-query.dto';
import { CogsReportQueryDto } from './dto/cogs-report-query.dto';
import {
  FiscalPeriodStatus,
  JournalEntryStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';

@Injectable()
export class CostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
    private readonly valuationService: InventoryValuationService,
    private readonly cogsService: CogsService,
  ) {}

  /**
   * Record inventory receipt costing and optionally post GL journal (Debit INVENTORY_ASSET, Credit PURCHASE_CLEARING)
   */
  async recordReceipt(
    organizationId: string,
    dto: RecordReceiptCostDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const valuation = await this.valuationService.processInbound(
        organizationId,
        {
          itemId: dto.itemId,
          variantId: dto.variantId,
          locationId: dto.locationId,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          batchId: dto.batchId,
          sourceDocument: dto.sourceDocument,
          sourceDocumentId: dto.sourceDocumentId,
        },
        tx,
        actorUserId,
      );

      const totalCost = new Prisma.Decimal(dto.quantity).mul(
        new Prisma.Decimal(dto.unitCost),
      );
      let journalEntryId: string | null = null;

      if (dto.postToGl !== false && totalCost.greaterThan(0)) {
        const today = new Date();
        const fiscalPeriod = await tx.fiscalPeriod.findFirst({
          where: {
            organizationId,
            status: FiscalPeriodStatus.OPEN,
            startDate: { lte: today },
            endDate: { gte: today },
          },
        });
        if (!fiscalPeriod) {
          throw new BadRequestException(
            'No OPEN fiscal period found covering today to post inventory receipt journal.',
          );
        }

        const inventoryAssetAccountId =
          await this.accountMappingService.resolveAccount(
            organizationId,
            'INVENTORY_ASSET',
          );

        let purchaseClearingAccountId: string;
        try {
          purchaseClearingAccountId =
            await this.accountMappingService.resolveAccount(
              organizationId,
              'PURCHASE_CLEARING',
            );
        } catch {
          purchaseClearingAccountId =
            await this.accountMappingService.resolveAccount(
              organizationId,
              'ACCOUNTS_PAYABLE',
            );
        }

        let journalNumber: string;
        try {
          const seq = await this.numberingService.nextNumber(
            organizationId,
            'JOURNAL_ENTRY',
            actorUserId,
          );
          journalNumber = seq.formatted;
        } catch {
          const count = await tx.journalEntry.count({
            where: { organizationId },
          });
          journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
        }

        const glEntry = await tx.journalEntry.create({
          data: {
            organizationId,
            fiscalPeriodId: fiscalPeriod.id,
            entryNumber: journalNumber,
            entryDate: today,
            description: `Inventory Receipt: ${dto.sourceDocument} (${dto.sourceDocumentId ?? 'Inbound'})`,
            status: JournalEntryStatus.POSTED,
            sourceType: 'INVENTORY_RECEIPT',
            createdByUserId: actorUserId,
            postedByUserId: actorUserId,
            postedAt: today,
            lines: {
              create: [
                {
                  organizationId,
                  accountId: inventoryAssetAccountId,
                  description: `Inventory Asset - ${dto.sourceDocument}`,
                  debit: totalCost,
                  credit: new Prisma.Decimal(0),
                  lineNumber: 1,
                },
                {
                  organizationId,
                  accountId: purchaseClearingAccountId,
                  description: `Purchase Clearing / AP - ${dto.sourceDocument}`,
                  debit: new Prisma.Decimal(0),
                  credit: totalCost,
                  lineNumber: 2,
                },
              ],
            },
          },
        });
        journalEntryId = glEntry.id;
      }

      return {
        valuation,
        totalCost,
        journalEntryId,
      };
    });
  }

  /**
   * Record outbound issue and COGS
   */
  async recordIssueCogs(
    organizationId: string,
    dto: RecordIssueCogsDto,
    actorUserId: string,
  ) {
    return this.cogsService.recordAndPostCogs(
      organizationId,
      {
        itemId: dto.itemId,
        variantId: dto.variantId,
        locationId: dto.locationId,
        quantity: dto.quantity,
        stockMovementId: dto.stockMovementId,
        deliveryOrderId: dto.deliveryOrderId,
        sourceDocument: dto.sourceDocument,
        sourceDocumentId: dto.sourceDocumentId,
        postToGl: dto.postToGl,
      },
      actorUserId,
    );
  }

  /**
   * Record inventory adjustment costing and GL posting (ADJUSTMENT_IN or ADJUSTMENT_OUT)
   */
  async recordAdjustment(
    organizationId: string,
    dto: RecordAdjustmentCostDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const today = new Date();
      const qty = new Prisma.Decimal(dto.quantity);

      if (dto.movementType === StockMovementType.ADJUSTMENT_IN) {
        // Inbound adjustment
        // If unitCost not specified, use current average cost or 0
        let unitCost =
          dto.unitCost !== undefined
            ? new Prisma.Decimal(dto.unitCost)
            : undefined;
        if (unitCost === undefined) {
          const currentVal = await tx.inventoryValuation.findFirst({
            where: {
              organizationId,
              itemId: dto.itemId,
              variantId: dto.variantId ? dto.variantId : null,
              locationId: dto.locationId,
            },
          });
          unitCost = currentVal?.averageCost ?? new Prisma.Decimal(0);
        }

        const valuation = await this.valuationService.processInbound(
          organizationId,
          {
            itemId: dto.itemId,
            variantId: dto.variantId,
            locationId: dto.locationId,
            quantity: qty,
            unitCost,
            sourceDocument: 'INVENTORY_ADJUSTMENT_IN',
            sourceDocumentId: dto.stockMovementId,
          },
          tx,
          actorUserId,
        );

        const totalCost = qty.mul(unitCost);
        let journalEntryId: string | null = null;

        if (dto.postToGl !== false && totalCost.greaterThan(0)) {
          const fiscalPeriod = await tx.fiscalPeriod.findFirst({
            where: {
              organizationId,
              status: FiscalPeriodStatus.OPEN,
              startDate: { lte: today },
              endDate: { gte: today },
            },
          });
          if (!fiscalPeriod) {
            throw new BadRequestException(
              'No OPEN fiscal period found covering today to post adjustment journal.',
            );
          }

          const inventoryAssetAccountId =
            await this.accountMappingService.resolveAccount(
              organizationId,
              'INVENTORY_ASSET',
            );

          let adjustmentGainAccountId: string;
          try {
            adjustmentGainAccountId =
              await this.accountMappingService.resolveAccount(
                organizationId,
                'INVENTORY_ADJUSTMENT_GAIN',
              );
          } catch {
            adjustmentGainAccountId =
              await this.accountMappingService.resolveAccount(
                organizationId,
                'PURCHASE_EXPENSE',
              );
          }

          let journalNumber: string;
          try {
            const seq = await this.numberingService.nextNumber(
              organizationId,
              'JOURNAL_ENTRY',
              actorUserId,
            );
            journalNumber = seq.formatted;
          } catch {
            const count = await tx.journalEntry.count({
              where: { organizationId },
            });
            journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
          }

          // Debit INVENTORY_ASSET, Credit INVENTORY_ADJUSTMENT_GAIN
          const glEntry = await tx.journalEntry.create({
            data: {
              organizationId,
              fiscalPeriodId: fiscalPeriod.id,
              entryNumber: journalNumber,
              entryDate: today,
              description: `Inventory Adjustment (Gain): ${dto.reason ?? 'Positive Count Adjustment'}`,
              status: JournalEntryStatus.POSTED,
              sourceType: 'INVENTORY_ADJUSTMENT',
              sourceId: dto.stockMovementId ?? undefined,
              createdByUserId: actorUserId,
              postedByUserId: actorUserId,
              postedAt: today,
              lines: {
                create: [
                  {
                    organizationId,
                    accountId: inventoryAssetAccountId,
                    description: 'Inventory Asset increase',
                    debit: totalCost,
                    credit: new Prisma.Decimal(0),
                    lineNumber: 1,
                  },
                  {
                    organizationId,
                    accountId: adjustmentGainAccountId,
                    description: 'Inventory Adjustment Gain',
                    debit: new Prisma.Decimal(0),
                    credit: totalCost,
                    lineNumber: 2,
                  },
                ],
              },
            },
          });
          journalEntryId = glEntry.id;
        }

        return {
          movementType: dto.movementType,
          valuation,
          unitCost,
          totalCost,
          journalEntryId,
        };
      } else {
        // Outbound adjustment (ADJUSTMENT_OUT)
        const costResult = await this.valuationService.processOutbound(
          organizationId,
          {
            itemId: dto.itemId,
            variantId: dto.variantId,
            locationId: dto.locationId,
            quantity: qty,
            sourceDocument: 'INVENTORY_ADJUSTMENT_OUT',
            sourceDocumentId: dto.stockMovementId,
          },
          tx,
        );

        let journalEntryId: string | null = null;

        if (dto.postToGl !== false && costResult.totalCost.greaterThan(0)) {
          const fiscalPeriod = await tx.fiscalPeriod.findFirst({
            where: {
              organizationId,
              status: FiscalPeriodStatus.OPEN,
              startDate: { lte: today },
              endDate: { gte: today },
            },
          });
          if (!fiscalPeriod) {
            throw new BadRequestException(
              'No OPEN fiscal period found covering today to post adjustment journal.',
            );
          }

          let adjustmentLossAccountId: string;
          try {
            adjustmentLossAccountId =
              await this.accountMappingService.resolveAccount(
                organizationId,
                'INVENTORY_ADJUSTMENT_LOSS',
              );
          } catch {
            adjustmentLossAccountId =
              await this.accountMappingService.resolveAccount(
                organizationId,
                'PURCHASE_EXPENSE',
              );
          }

          const inventoryAssetAccountId =
            await this.accountMappingService.resolveAccount(
              organizationId,
              'INVENTORY_ASSET',
            );

          let journalNumber: string;
          try {
            const seq = await this.numberingService.nextNumber(
              organizationId,
              'JOURNAL_ENTRY',
              actorUserId,
            );
            journalNumber = seq.formatted;
          } catch {
            const count = await tx.journalEntry.count({
              where: { organizationId },
            });
            journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
          }

          // Debit INVENTORY_ADJUSTMENT_LOSS, Credit INVENTORY_ASSET
          const glEntry = await tx.journalEntry.create({
            data: {
              organizationId,
              fiscalPeriodId: fiscalPeriod.id,
              entryNumber: journalNumber,
              entryDate: today,
              description: `Inventory Adjustment (Loss): ${dto.reason ?? 'Negative Count Adjustment'}`,
              status: JournalEntryStatus.POSTED,
              sourceType: 'INVENTORY_ADJUSTMENT',
              sourceId: dto.stockMovementId ?? undefined,
              createdByUserId: actorUserId,
              postedByUserId: actorUserId,
              postedAt: today,
              lines: {
                create: [
                  {
                    organizationId,
                    accountId: adjustmentLossAccountId,
                    description: 'Inventory Adjustment Loss',
                    debit: costResult.totalCost,
                    credit: new Prisma.Decimal(0),
                    lineNumber: 1,
                  },
                  {
                    organizationId,
                    accountId: inventoryAssetAccountId,
                    description: 'Inventory Asset reduction',
                    debit: new Prisma.Decimal(0),
                    credit: costResult.totalCost,
                    lineNumber: 2,
                  },
                ],
              },
            },
          });
          journalEntryId = glEntry.id;
        }

        return {
          movementType: dto.movementType,
          valuation: costResult.valuation,
          unitCost: costResult.unitCost,
          totalCost: costResult.totalCost,
          journalEntryId,
        };
      }
    });
  }

  /**
   * Record Customer Return Restock costing & GL (Debit INVENTORY_ASSET, Credit COGS)
   */
  async recordReturnRestock(
    organizationId: string,
    dto: RecordReturnRestockCostDto,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const today = new Date();
      const qty = new Prisma.Decimal(dto.quantity);

      let unitCost =
        dto.unitCost !== undefined
          ? new Prisma.Decimal(dto.unitCost)
          : undefined;
      if (unitCost === undefined) {
        const currentVal = await tx.inventoryValuation.findFirst({
          where: {
            organizationId,
            itemId: dto.itemId,
            variantId: dto.variantId ? dto.variantId : null,
            locationId: dto.locationId,
          },
        });
        unitCost = currentVal?.averageCost ?? new Prisma.Decimal(0);
      }

      const valuation = await this.valuationService.processInbound(
        organizationId,
        {
          itemId: dto.itemId,
          variantId: dto.variantId,
          locationId: dto.locationId,
          quantity: qty,
          unitCost,
          sourceDocument: 'CUSTOMER_RETURN_RESTOCK',
          sourceDocumentId: dto.creditNoteId,
        },
        tx,
        actorUserId,
      );

      const totalCost = qty.mul(unitCost);
      let journalEntryId: string | null = null;

      if (dto.postToGl !== false && totalCost.greaterThan(0)) {
        const fiscalPeriod = await tx.fiscalPeriod.findFirst({
          where: {
            organizationId,
            status: FiscalPeriodStatus.OPEN,
            startDate: { lte: today },
            endDate: { gte: today },
          },
        });
        if (!fiscalPeriod) {
          throw new BadRequestException(
            'No OPEN fiscal period found covering today to post return restock journal.',
          );
        }

        const inventoryAssetAccountId =
          await this.accountMappingService.resolveAccount(
            organizationId,
            'INVENTORY_ASSET',
          );

        let cogsAccountId: string;
        try {
          cogsAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'COGS',
          );
        } catch {
          cogsAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'PURCHASE_EXPENSE',
          );
        }

        let journalNumber: string;
        try {
          const seq = await this.numberingService.nextNumber(
            organizationId,
            'JOURNAL_ENTRY',
            actorUserId,
          );
          journalNumber = seq.formatted;
        } catch {
          const count = await tx.journalEntry.count({
            where: { organizationId },
          });
          journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
        }

        // Debit INVENTORY_ASSET, Credit COGS
        const glEntry = await tx.journalEntry.create({
          data: {
            organizationId,
            fiscalPeriodId: fiscalPeriod.id,
            entryNumber: journalNumber,
            entryDate: today,
            description: `Customer Return Restock: ${dto.reason ?? 'Restock'}`,
            status: JournalEntryStatus.POSTED,
            sourceType: 'CUSTOMER_RETURN_RESTOCK',
            sourceId: dto.creditNoteId ?? undefined,
            createdByUserId: actorUserId,
            postedByUserId: actorUserId,
            postedAt: today,
            lines: {
              create: [
                {
                  organizationId,
                  accountId: inventoryAssetAccountId,
                  description: 'Inventory Asset restock',
                  debit: totalCost,
                  credit: new Prisma.Decimal(0),
                  lineNumber: 1,
                },
                {
                  organizationId,
                  accountId: cogsAccountId,
                  description: 'COGS reversal from restock',
                  debit: new Prisma.Decimal(0),
                  credit: totalCost,
                  lineNumber: 2,
                },
              ],
            },
          },
        });
        journalEntryId = glEntry.id;
      }

      return {
        valuation,
        unitCost,
        totalCost,
        journalEntryId,
      };
    });
  }

  /**
   * Reports delegation
   */
  async getValuation(organizationId: string, query: ValuationQueryDto) {
    return this.valuationService.getValuation(organizationId, query);
  }

  async getItemCostHistory(
    organizationId: string,
    itemId: string,
    query: ItemCostHistoryQueryDto,
  ) {
    return this.valuationService.getItemCostHistory(
      organizationId,
      itemId,
      query,
    );
  }

  async getCogsReport(organizationId: string, query: CogsReportQueryDto) {
    return this.cogsService.getCogsReport(organizationId, query);
  }
}
