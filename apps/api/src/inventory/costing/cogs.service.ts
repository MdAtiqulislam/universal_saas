import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { InventoryValuationService } from './inventory-valuation.service';
import { CogsReportQueryDto } from './dto/cogs-report-query.dto';
import { FiscalPeriodStatus, JournalEntryStatus, Prisma } from '@prisma/client';

export interface RecordCogsParams {
  itemId: string;
  variantId?: string | null;
  locationId: string;
  quantity: number | Prisma.Decimal;
  stockMovementId?: string | null;
  deliveryOrderId?: string | null;
  sourceDocument: string;
  sourceDocumentId?: string | null;
  postToGl?: boolean;
}

@Injectable()
export class CogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
    private readonly valuationService: InventoryValuationService,
  ) {}

  /**
   * Record COGS for outbound inventory and post double-entry GL journal:
   * Debit: COGS
   * Credit: INVENTORY_ASSET
   */
  async recordAndPostCogs(
    organizationId: string,
    params: RecordCogsParams,
    actorUserId: string,
    existingTx?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Process outbound inventory and calculate cost
      const costResult = await this.valuationService.processOutbound(
        organizationId,
        {
          itemId: params.itemId,
          variantId: params.variantId,
          locationId: params.locationId,
          quantity: params.quantity,
          sourceDocument: params.sourceDocument,
          sourceDocumentId: params.sourceDocumentId,
        },
        tx,
      );

      let journalEntryId: string | null = null;

      // 2. Post to General Ledger if requested and totalCost > 0
      if (params.postToGl !== false && costResult.totalCost.greaterThan(0)) {
        // 2.1 Find open fiscal period
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
            'No OPEN fiscal period found covering today to post COGS journal.',
          );
        }

        // 2.2 Resolve account mappings
        let cogsAccountId: string;
        try {
          cogsAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'COGS',
          );
        } catch {
          // Fallback to PURCHASE_EXPENSE
          cogsAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'PURCHASE_EXPENSE',
          );
        }

        const inventoryAssetAccountId =
          await this.accountMappingService.resolveAccount(
            organizationId,
            'INVENTORY_ASSET',
          );

        // 2.3 Generate journal number
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

        // 2.4 Create balanced journal entry: Debit COGS, Credit INVENTORY_ASSET
        const glEntry = await tx.journalEntry.create({
          data: {
            organizationId,
            fiscalPeriodId: fiscalPeriod.id,
            entryNumber: journalNumber,
            entryDate: today,
            description: `COGS: ${params.sourceDocument} (${params.sourceDocumentId ?? 'Direct Issue'})`,
            status: JournalEntryStatus.POSTED,
            sourceType: 'COGS',
            sourceId: params.deliveryOrderId ?? undefined,
            createdByUserId: actorUserId,
            postedByUserId: actorUserId,
            postedAt: today,
            lines: {
              create: [
                {
                  organizationId,
                  accountId: cogsAccountId,
                  description: `COGS - ${params.sourceDocument}`,
                  debit: costResult.totalCost,
                  credit: new Prisma.Decimal(0),
                  lineNumber: 1,
                },
                {
                  organizationId,
                  accountId: inventoryAssetAccountId,
                  description: `Inventory Asset reduction - ${params.sourceDocument}`,
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

      // 3. Create immutable COGS record
      const cogsRecord = await tx.costOfGoodsSoldRecord.create({
        data: {
          organizationId,
          itemId: params.itemId,
          variantId: params.variantId ?? null,
          locationId: params.locationId,
          stockMovementId: params.stockMovementId ?? null,
          deliveryOrderId: params.deliveryOrderId ?? null,
          journalEntryId,
          quantity: costResult.quantityIssued,
          unitCost: costResult.unitCost,
          totalCost: costResult.totalCost,
          sourceDocument: params.sourceDocument,
          sourceDocumentId: params.sourceDocumentId ?? null,
        },
        include: {
          item: true,
          variant: true,
          location: true,
          journalEntry: true,
        },
      });

      return {
        cogsRecord,
        unitCost: costResult.unitCost,
        totalCost: costResult.totalCost,
        quantity: costResult.quantityIssued,
      };
    };

    const result = existingTx
      ? await execute(existingTx)
      : await this.prisma.$transaction(execute);

    await this.eventBus.publish({
      eventName: 'COGS_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'cogs.posted',
      resource: 'cost_of_goods_sold_record',
      resourceId: result.cogsRecord.id,
      details: {
        itemId: params.itemId,
        quantity: result.quantity.toFixed(4),
        totalCost: result.totalCost.toFixed(4),
      },
    });

    return result;
  }

  /**
   * Get COGS reports with filters and aggregation
   */
  async getCogsReport(organizationId: string, query: CogsReportQueryDto) {
    const where: Prisma.CostOfGoodsSoldRecordWhereInput = {
      organizationId,
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.sourceDocument
        ? {
            sourceDocument: {
              contains: query.sourceDocument,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            recordedAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total, summary] = await Promise.all([
      this.prisma.costOfGoodsSoldRecord.findMany({
        where,
        include: {
          item: true,
          variant: true,
          location: true,
          journalEntry: true,
        },
        orderBy: { recordedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.costOfGoodsSoldRecord.count({ where }),
      this.prisma.costOfGoodsSoldRecord.aggregate({
        where,
        _sum: {
          quantity: true,
          totalCost: true,
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalQuantityIssued: summary._sum.quantity ?? new Prisma.Decimal(0),
        totalCogs: summary._sum.totalCost ?? new Prisma.Decimal(0),
      },
    };
  }
}
