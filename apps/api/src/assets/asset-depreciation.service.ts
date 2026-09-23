import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { DepreciationRunDto } from './dto/depreciation-run.dto';
import {
  Prisma,
  FixedAssetStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  AssetDepreciationEntryStatus,
} from '@prisma/client';

@Injectable()
export class AssetDepreciationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  async getSchedule(organizationId: string, assetId: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id: assetId, organizationId, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException(`Fixed asset ${assetId} not found.`);
    }

    return this.prisma.assetDepreciationEntry.findMany({
      where: { organizationId, assetId },
      include: {
        fiscalPeriod: true,
        journalEntry: true,
      },
      orderBy: { periodStart: 'asc' },
    });
  }

  async postEntry(organizationId: string, entryId: string, userId: string) {
    const entry = await this.prisma.assetDepreciationEntry.findFirst({
      where: { id: entryId, organizationId },
      include: {
        asset: { include: { category: true } },
        fiscalPeriod: true,
      },
    });

    if (!entry) {
      throw new NotFoundException(`Depreciation entry ${entryId} not found.`);
    }

    if (entry.status === AssetDepreciationEntryStatus.POSTED) {
      return entry; // Idempotent return
    }

    if (entry.status === AssetDepreciationEntryStatus.VOIDED) {
      throw new BadRequestException('Cannot post a VOIDED depreciation entry.');
    }

    if (entry.fiscalPeriod.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Fiscal period ${entry.fiscalPeriod.name} is ${entry.fiscalPeriod.status}. Depreciation can only be posted in an OPEN fiscal period.`,
      );
    }

    const asset = entry.asset;
    if (
      asset.status !== FixedAssetStatus.ACTIVE &&
      asset.status !== FixedAssetStatus.CAPITALIZED
    ) {
      throw new BadRequestException(
        `Cannot post depreciation for asset in status ${asset.status}.`,
      );
    }

    // Resolve GL accounts
    const depExpenseAccountId =
      asset.depreciationExpenseAccountId ??
      asset.category.depreciationExpenseAccountId ??
      (await this.accountMappingService.resolveAccount(
        organizationId,
        'DEPRECIATION_EXPENSE',
      ));

    const accumulatedDepAccountId =
      asset.accumulatedDepreciationAccountId ??
      asset.category.accumulatedDepreciationAccountId ??
      (await this.accountMappingService.resolveAccount(
        organizationId,
        'ACCUMULATED_DEPRECIATION',
      ));

    const journalNumber = await this.numberingService.nextNumber(
      organizationId,
      'JOURNAL_ENTRY',
    );

    return this.prisma.$transaction(async (tx) => {
      // Create Balanced Depreciation Journal Entry
      const journal = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: entry.fiscalPeriodId,
          entryNumber: journalNumber.formatted,
          entryDate: entry.periodEnd,
          description: `Depreciation for Asset ${asset.assetNumber} - ${asset.name} (${entry.fiscalPeriod.name})`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'FIXED_ASSET_DEPRECIATION',
          sourceId: entry.id,
          createdByUserId: userId,
          postedAt: new Date(),
          postedByUserId: userId,
          lines: {
            create: [
              {
                organizationId,
                accountId: depExpenseAccountId,
                lineNumber: 1,
                debit: entry.depreciationAmount,
                credit: new Prisma.Decimal(0),
                description: `Depreciation Expense - ${asset.name}`,
              },
              {
                organizationId,
                accountId: accumulatedDepAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: entry.depreciationAmount,
                description: `Accumulated Depreciation - ${asset.name}`,
              },
            ],
          },
        },
      });

      // Update Entry
      const updatedEntry = await tx.assetDepreciationEntry.update({
        where: { id: entry.id },
        data: {
          status: AssetDepreciationEntryStatus.POSTED,
          journalEntryId: journal.id,
          postedAt: new Date(),
          postedByUserId: userId,
        },
        include: { journalEntry: true },
      });

      // Update Fixed Asset totals
      const newAccumulated = asset.accumulatedDepreciation.add(
        entry.depreciationAmount,
      );
      const newNetBookValue = asset.acquisitionCost.sub(newAccumulated);

      const isFullyDepreciated = newNetBookValue.lessThanOrEqualTo(
        asset.residualValue,
      );

      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: newAccumulated,
          netBookValue: newNetBookValue,
          ...(isFullyDepreciated
            ? { status: FixedAssetStatus.FULLY_DEPRECIATED }
            : {}),
        },
      });

      await this.eventBus.publish({
        eventName: 'ASSET_DEPRECIATION_POSTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'asset_depreciation.posted',
        resource: 'asset_depreciation_entry',
        resourceId: entry.id,
        details: {
          assetId: asset.id,
          journalEntryId: journal.id,
          depreciationAmount: entry.depreciationAmount.toFixed(4),
        },
      });

      return updatedEntry;
    });
  }

  async runDepreciation(
    organizationId: string,
    dto: DepreciationRunDto,
    userId: string,
  ) {
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: { id: dto.fiscalPeriodId, organizationId },
    });
    if (!fiscalPeriod) {
      throw new NotFoundException(
        `Fiscal period ${dto.fiscalPeriodId} not found in this organization.`,
      );
    }

    if (fiscalPeriod.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Cannot run depreciation on ${fiscalPeriod.status} fiscal period "${fiscalPeriod.name}".`,
      );
    }

    const where: Prisma.AssetDepreciationEntryWhereInput = {
      organizationId,
      fiscalPeriodId: dto.fiscalPeriodId,
      status: AssetDepreciationEntryStatus.SCHEDULED,
      ...(dto.assetIds && dto.assetIds.length > 0
        ? { assetId: { in: dto.assetIds } }
        : {}),
      asset: {
        status: { in: [FixedAssetStatus.ACTIVE, FixedAssetStatus.CAPITALIZED] },
        deletedAt: null,
      },
    };

    const scheduledEntries = await this.prisma.assetDepreciationEntry.findMany({
      where,
      select: { id: true },
    });

    const postedEntries = [];
    let totalDepreciation = new Prisma.Decimal(0);

    for (const item of scheduledEntries) {
      const posted = await this.postEntry(organizationId, item.id, userId);
      postedEntries.push(posted);
      totalDepreciation = totalDepreciation.add(posted.depreciationAmount);
    }

    await this.eventBus.publish({
      eventName: 'ASSET_DEPRECIATION_CALCULATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'asset_depreciation.calculated',
      resource: 'depreciation_run',
      resourceId: dto.fiscalPeriodId,
      details: {
        fiscalPeriodId: dto.fiscalPeriodId,
        processedCount: postedEntries.length,
        totalDepreciation: totalDepreciation.toFixed(4),
      },
    });

    return {
      fiscalPeriodId: dto.fiscalPeriodId,
      processedCount: postedEntries.length,
      totalDepreciationAmount: totalDepreciation.toFixed(4),
      entries: postedEntries,
    };
  }
}
