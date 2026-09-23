import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { DisposeFixedAssetDto } from './dto/dispose-fixed-asset.dto';
import {
  Prisma,
  FixedAssetStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  AssetDepreciationEntryStatus,
} from '@prisma/client';

@Injectable()
export class AssetDisposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  async dispose(
    organizationId: string,
    id: string,
    dto: DisposeFixedAssetDto,
    userId: string,
  ) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { category: true },
    });

    if (!asset) {
      throw new NotFoundException(`Fixed asset ${id} not found.`);
    }

    if (
      asset.status !== FixedAssetStatus.ACTIVE &&
      asset.status !== FixedAssetStatus.CAPITALIZED &&
      asset.status !== FixedAssetStatus.FULLY_DEPRECIATED &&
      asset.status !== FixedAssetStatus.IMPAIRED
    ) {
      throw new BadRequestException(
        `Cannot dispose asset in status ${asset.status}. Asset must be ACTIVE, CAPITALIZED, or FULLY_DEPRECIATED.`,
      );
    }

    const disposalDate = new Date(dto.disposalDate);
    const proceeds = new Prisma.Decimal(dto.disposalProceeds ?? 0);
    if (proceeds.lessThan(0)) {
      throw new BadRequestException('Disposal proceeds cannot be negative.');
    }

    // 1. Resolve Fiscal Period for disposal date
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: disposalDate },
        endDate: { gte: disposalDate },
        status: FiscalPeriodStatus.OPEN,
      },
    });

    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found for disposal date ${disposalDate.toISOString().slice(0, 10)}.`,
      );
    }

    // 2. Resolve GL accounts
    const assetAccountId =
      asset.assetAccountId ??
      asset.category.assetAccountId ??
      (await this.accountMappingService.resolveAccount(
        organizationId,
        'FIXED_ASSET',
      ));

    const accumulatedDepAccountId =
      asset.accumulatedDepreciationAccountId ??
      asset.category.accumulatedDepreciationAccountId ??
      (await this.accountMappingService.resolveAccount(
        organizationId,
        'ACCUMULATED_DEPRECIATION',
      ));

    let cashAccountId: string | null = null;
    if (proceeds.greaterThan(0)) {
      if (dto.proceedsPaymentAccountId) {
        const paymentAcc = await this.prisma.paymentAccount.findFirst({
          where: {
            id: dto.proceedsPaymentAccountId,
            organizationId,
            isActive: true,
          },
        });
        if (!paymentAcc) {
          throw new NotFoundException(
            `Payment account ${dto.proceedsPaymentAccountId} not found.`,
          );
        }
        cashAccountId = paymentAcc.accountingAccountId;
      } else {
        // Fallback to accounts receivable or bank mapping
        cashAccountId = await this.accountMappingService.resolveAccount(
          organizationId,
          'ACCOUNTS_RECEIVABLE',
        );
      }
    }

    // 3. Compute Net Book Value & Gain / Loss
    const netBookValue = asset.acquisitionCost.sub(
      asset.accumulatedDepreciation,
    );
    const gainLoss = proceeds.sub(netBookValue);

    let gainLossAccountId: string | null = null;
    if (gainLoss.greaterThan(0)) {
      gainLossAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'ASSET_DISPOSAL_GAIN',
      );
    } else if (gainLoss.lessThan(0)) {
      gainLossAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'ASSET_DISPOSAL_LOSS',
      );
    }

    const journalNumber = await this.numberingService.nextNumber(
      organizationId,
      'JOURNAL_ENTRY',
    );

    return this.prisma.$transaction(async (tx) => {
      // Build balanced journal lines
      const rawLines: Array<{
        organizationId: string;
        accountId: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        description: string;
      }> = [];

      // 1. Debit Accumulated Depreciation for full accumulated amount
      if (asset.accumulatedDepreciation.greaterThan(0)) {
        rawLines.push({
          organizationId,
          accountId: accumulatedDepAccountId,
          debit: asset.accumulatedDepreciation,
          credit: new Prisma.Decimal(0),
          description: `Write off Accumulated Depreciation - ${asset.name}`,
        });
      }

      // 2. Debit Cash / Receivable if proceeds exist
      if (proceeds.greaterThan(0) && cashAccountId) {
        rawLines.push({
          organizationId,
          accountId: cashAccountId,
          debit: proceeds,
          credit: new Prisma.Decimal(0),
          description: `Disposal Proceeds - ${asset.name}`,
        });
      }

      // 3. Loss (Debit) or Gain (Credit)
      if (gainLoss.lessThan(0) && gainLossAccountId) {
        rawLines.push({
          organizationId,
          accountId: gainLossAccountId,
          debit: gainLoss.abs(),
          credit: new Prisma.Decimal(0),
          description: `Loss on Asset Disposal - ${asset.name}`,
        });
      } else if (gainLoss.greaterThan(0) && gainLossAccountId) {
        rawLines.push({
          organizationId,
          accountId: gainLossAccountId,
          debit: new Prisma.Decimal(0),
          credit: gainLoss,
          description: `Gain on Asset Disposal - ${asset.name}`,
        });
      }

      // 4. Credit Fixed Asset Account for full acquisition cost
      rawLines.push({
        organizationId,
        accountId: assetAccountId,
        debit: new Prisma.Decimal(0),
        credit: asset.acquisitionCost,
        description: `Write off Fixed Asset - ${asset.name}`,
      });

      const lines: Prisma.JournalLineUncheckedCreateWithoutJournalEntryInput[] =
        rawLines.map((l, idx) => ({
          ...l,
          lineNumber: idx + 1,
        }));

      // Create Disposal Journal Entry
      const journal = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber.formatted,
          entryDate: disposalDate,
          description: `Disposal of fixed asset ${asset.assetNumber} - ${asset.name}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'FIXED_ASSET_DISPOSAL',
          sourceId: asset.id,
          createdByUserId: userId,
          postedAt: new Date(),
          postedByUserId: userId,
          lines: { create: lines },
        },
      });

      // Void any remaining scheduled depreciation entries
      await tx.assetDepreciationEntry.updateMany({
        where: {
          organizationId,
          assetId: asset.id,
          status: AssetDepreciationEntryStatus.SCHEDULED,
        },
        data: { status: AssetDepreciationEntryStatus.VOIDED },
      });

      // Update Fixed Asset to DISPOSED
      const updatedAsset = await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          status: FixedAssetStatus.DISPOSED,
          disposedAt: disposalDate,
          disposedByUserId: userId,
          disposalProceeds: proceeds,
          disposalGainLoss: gainLoss,
          disposalJournalEntryId: journal.id,
          disposalReason: dto.disposalReason,
          netBookValue: new Prisma.Decimal(0),
        },
        include: {
          category: true,
          disposalJournalEntry: {
            include: { lines: { include: { account: true } } },
          },
        },
      });

      await this.eventBus.publish({
        eventName: 'ASSET_DISPOSED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'asset.disposed',
        resource: 'fixed_asset',
        resourceId: updatedAsset.id,
        details: {
          assetNumber: updatedAsset.assetNumber,
          proceeds: proceeds.toFixed(4),
          gainLoss: gainLoss.toFixed(4),
          journalEntryId: journal.id,
        },
      });

      return updatedAsset;
    });
  }
}
