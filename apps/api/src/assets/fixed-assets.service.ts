import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../ap/account-mapping/ap-account-mapping.service';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';
import { TransferFixedAssetDto } from './dto/transfer-fixed-asset.dto';
import { AssetReportQueryDto } from './dto/asset-report-query.dto';
import {
  Prisma,
  FixedAssetStatus,
  FiscalPeriodStatus,
  JournalEntryStatus,
  AssetDepreciationEntryStatus,
} from '@prisma/client';

@Injectable()
export class FixedAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateFixedAssetDto,
    userId: string,
  ) {
    // 1. Validate Category
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: dto.categoryId, organizationId, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException(
        `Asset category ${dto.categoryId} not found.`,
      );
    }

    // 2. Validate Currency
    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId, isActive: true },
    });
    if (!currency) {
      throw new NotFoundException(`Currency ${dto.currencyId} not found.`);
    }

    // 3. Validate Location if provided
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId, deletedAt: null },
      });
      if (!location) {
        throw new NotFoundException(`Location ${dto.locationId} not found.`);
      }
    }

    // 4. Validate Supplier if provided
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, organizationId, deletedAt: null },
      });
      if (!supplier) {
        throw new NotFoundException(`Supplier ${dto.supplierId} not found.`);
      }
    }

    // 5. Validate Source Documents
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: dto.purchaseOrderId, organizationId },
      });
      if (!po) {
        throw new NotFoundException(
          `Purchase Order ${dto.purchaseOrderId} not found.`,
        );
      }
    }

    if (dto.goodsReceiptId) {
      const gr = await this.prisma.goodsReceipt.findFirst({
        where: { id: dto.goodsReceiptId, organizationId },
      });
      if (!gr) {
        throw new NotFoundException(
          `Goods Receipt ${dto.goodsReceiptId} not found.`,
        );
      }
    }

    if (dto.supplierInvoiceId) {
      const si = await this.prisma.supplierInvoice.findFirst({
        where: { id: dto.supplierInvoiceId, organizationId },
      });
      if (!si) {
        throw new NotFoundException(
          `Supplier Invoice ${dto.supplierInvoiceId} not found.`,
        );
      }
    }

    // 6. Cost & Value Calculations
    const acquisitionCost = new Prisma.Decimal(dto.acquisitionCost);
    if (acquisitionCost.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Acquisition cost must be greater than zero.',
      );
    }

    let residualValue = new Prisma.Decimal(0);
    if (dto.residualValue !== undefined) {
      residualValue = new Prisma.Decimal(dto.residualValue);
      if (residualValue.lessThan(0)) {
        throw new BadRequestException('Residual value cannot be negative.');
      }
      if (residualValue.greaterThan(acquisitionCost)) {
        throw new BadRequestException(
          'Residual value cannot exceed acquisition cost.',
        );
      }
    } else if (category.defaultResidualValuePercent.greaterThan(0)) {
      residualValue = acquisitionCost
        .mul(category.defaultResidualValuePercent)
        .div(100);
    }

    const usefulLifeMonths =
      dto.usefulLifeMonths ?? category.defaultUsefulLifeMonths;
    if (usefulLifeMonths <= 0) {
      throw new BadRequestException(
        'Useful life in months must be greater than zero.',
      );
    }

    const depreciationMethod =
      dto.depreciationMethod ?? category.depreciationMethod;

    // 7. Numbering
    let assetNumber = dto.assetNumber;
    if (!assetNumber) {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'FIXED_ASSET',
      );
      assetNumber = generated.formatted;
    } else {
      const duplicate = await this.prisma.fixedAsset.findFirst({
        where: { organizationId, assetNumber, deletedAt: null },
      });
      if (duplicate) {
        throw new ConflictException(
          `Fixed asset with number "${assetNumber}" already exists.`,
        );
      }
    }

    const asset = await this.prisma.fixedAsset.create({
      data: {
        organizationId,
        assetNumber,
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        serialNumber: dto.serialNumber,
        locationId: dto.locationId,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId,
        goodsReceiptId: dto.goodsReceiptId,
        supplierInvoiceId: dto.supplierInvoiceId,
        currencyId: dto.currencyId,
        acquisitionDate: new Date(dto.acquisitionDate),
        placedInServiceDate: dto.placedInServiceDate
          ? new Date(dto.placedInServiceDate)
          : null,
        acquisitionCost,
        residualValue,
        accumulatedDepreciation: new Prisma.Decimal(0),
        netBookValue: acquisitionCost,
        usefulLifeMonths,
        depreciationMethod,
        status: FixedAssetStatus.DRAFT,
        assetAccountId: dto.assetAccountId ?? category.assetAccountId,
        accumulatedDepreciationAccountId:
          dto.accumulatedDepreciationAccountId ??
          category.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId:
          dto.depreciationExpenseAccountId ??
          category.depreciationExpenseAccountId,
        createdByUserId: userId,
      },
      include: {
        category: true,
        location: true,
        supplier: true,
        currency: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'ASSET_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'asset.created',
      resource: 'fixed_asset',
      resourceId: asset.id,
      details: {
        assetNumber: asset.assetNumber,
        name: asset.name,
        acquisitionCost: asset.acquisitionCost.toFixed(4),
      },
    });

    return asset;
  }

  async findAll(organizationId: string, query: AssetReportQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.FixedAssetWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.startDate || query.endDate
        ? {
            acquisitionDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.fixedAsset.findMany({
        where,
        include: {
          category: true,
          location: true,
          supplier: true,
          currency: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.fixedAsset.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(organizationId: string, id: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        category: true,
        location: true,
        supplier: true,
        purchaseOrder: true,
        goodsReceipt: true,
        supplierInvoice: true,
        currency: true,
        assetAccount: true,
        accumulatedDepreciationAccount: true,
        depreciationExpenseAccount: true,
        capitalizationJournalEntry: {
          include: { lines: { include: { account: true } } },
        },
        disposalJournalEntry: {
          include: { lines: { include: { account: true } } },
        },
        depreciationEntries: {
          orderBy: { periodStart: 'asc' },
          include: { fiscalPeriod: true },
        },
        transfers: {
          orderBy: { transferDate: 'desc' },
          include: { fromLocation: true, toLocation: true },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(`Fixed asset ${id} not found.`);
    }

    return asset;
  }

  async update(organizationId: string, id: string, dto: UpdateFixedAssetDto) {
    const existing = await this.findOne(organizationId, id);

    if (existing.status !== FixedAssetStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot edit fixed asset in status ${existing.status}. Only DRAFT assets can be modified.`,
      );
    }

    const acquisitionCost =
      dto.acquisitionCost !== undefined
        ? new Prisma.Decimal(dto.acquisitionCost)
        : existing.acquisitionCost;

    if (acquisitionCost.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Acquisition cost must be greater than zero.',
      );
    }

    let residualValue = existing.residualValue;
    if (dto.residualValue !== undefined) {
      residualValue = new Prisma.Decimal(dto.residualValue);
      if (residualValue.lessThan(0)) {
        throw new BadRequestException('Residual value cannot be negative.');
      }
      if (residualValue.greaterThan(acquisitionCost)) {
        throw new BadRequestException(
          'Residual value cannot exceed acquisition cost.',
        );
      }
    }

    return this.prisma.fixedAsset.update({
      where: { id: existing.id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.serialNumber !== undefined
          ? { serialNumber: dto.serialNumber }
          : {}),
        ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.purchaseOrderId !== undefined
          ? { purchaseOrderId: dto.purchaseOrderId }
          : {}),
        ...(dto.goodsReceiptId !== undefined
          ? { goodsReceiptId: dto.goodsReceiptId }
          : {}),
        ...(dto.supplierInvoiceId !== undefined
          ? { supplierInvoiceId: dto.supplierInvoiceId }
          : {}),
        ...(dto.acquisitionDate
          ? { acquisitionDate: new Date(dto.acquisitionDate) }
          : {}),
        ...(dto.placedInServiceDate !== undefined
          ? {
              placedInServiceDate: dto.placedInServiceDate
                ? new Date(dto.placedInServiceDate)
                : null,
            }
          : {}),
        acquisitionCost,
        residualValue,
        netBookValue: acquisitionCost,
        ...(dto.usefulLifeMonths
          ? { usefulLifeMonths: dto.usefulLifeMonths }
          : {}),
        ...(dto.depreciationMethod
          ? { depreciationMethod: dto.depreciationMethod }
          : {}),
        ...(dto.assetAccountId !== undefined
          ? { assetAccountId: dto.assetAccountId }
          : {}),
        ...(dto.accumulatedDepreciationAccountId !== undefined
          ? {
              accumulatedDepreciationAccountId:
                dto.accumulatedDepreciationAccountId,
            }
          : {}),
        ...(dto.depreciationExpenseAccountId !== undefined
          ? {
              depreciationExpenseAccountId: dto.depreciationExpenseAccountId,
            }
          : {}),
      },
      include: {
        category: true,
        location: true,
        supplier: true,
        currency: true,
      },
    });
  }

  async capitalize(organizationId: string, id: string, userId: string) {
    const asset = await this.findOne(organizationId, id);

    if (asset.status !== FixedAssetStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot capitalize fixed asset in status ${asset.status}. Asset must be in DRAFT.`,
      );
    }

    // 1. Resolve Accounts
    const assetAccountId =
      asset.assetAccountId ??
      asset.category.assetAccountId ??
      (await this.accountMappingService.resolveAccount(
        organizationId,
        'FIXED_ASSET',
      ));

    const apAccountId = await this.accountMappingService.resolveAccount(
      organizationId,
      'ACCOUNTS_PAYABLE',
    );

    // 2. Resolve Fiscal Period for acquisition
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: asset.acquisitionDate },
        endDate: { gte: asset.acquisitionDate },
        status: FiscalPeriodStatus.OPEN,
      },
    });
    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found for acquisition date ${asset.acquisitionDate.toISOString().slice(0, 10)}.`,
      );
    }

    // 3. Numbering for Journal Entry
    const journalNumber = await this.numberingService.nextNumber(
      organizationId,
      'JOURNAL_ENTRY',
    );

    const isActivated =
      asset.placedInServiceDate !== null &&
      asset.placedInServiceDate <= new Date();

    const targetStatus = isActivated
      ? FixedAssetStatus.ACTIVE
      : FixedAssetStatus.CAPITALIZED;

    return this.prisma.$transaction(async (tx) => {
      // Create Balanced Capitalization Journal Entry
      const journal = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber.formatted,
          entryDate: asset.acquisitionDate,
          description: `Capitalization of fixed asset ${asset.assetNumber} - ${asset.name}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'FIXED_ASSET_CAPITALIZATION',
          sourceId: asset.id,
          createdByUserId: userId,
          postedAt: new Date(),
          postedByUserId: userId,
          lines: {
            create: [
              {
                organizationId,
                accountId: assetAccountId,
                lineNumber: 1,
                debit: asset.acquisitionCost,
                credit: new Prisma.Decimal(0),
                description: `Asset Capitalization - ${asset.name}`,
              },
              {
                organizationId,
                accountId: apAccountId,
                lineNumber: 2,
                debit: new Prisma.Decimal(0),
                credit: asset.acquisitionCost,
                description: `Acquisition Clearing / AP - ${asset.name}`,
              },
            ],
          },
        },
      });

      // Generate straight-line depreciation schedule
      const depreciableBase = asset.acquisitionCost.sub(asset.residualValue);
      const monthlyDep = depreciableBase.div(asset.usefulLifeMonths);

      const scheduleEntries: Prisma.AssetDepreciationEntryCreateManyInput[] =
        [];
      let runningAccumulated = new Prisma.Decimal(0);
      let runningBookValue = asset.acquisitionCost;

      const startDate = asset.placedInServiceDate ?? asset.acquisitionDate;
      const allFiscalPeriods = await tx.fiscalPeriod.findMany({
        where: { organizationId },
        orderBy: { startDate: 'asc' },
      });

      for (let i = 0; i < asset.usefulLifeMonths; i++) {
        const periodDate = new Date(startDate);
        periodDate.setMonth(periodDate.getMonth() + i);

        // Find or map matching fiscal period
        const period = allFiscalPeriods.find(
          (p) => p.startDate <= periodDate && p.endDate >= periodDate,
        );

        let depAmount = monthlyDep;
        // On the final period, absorb any rounding residue
        if (i === asset.usefulLifeMonths - 1) {
          depAmount = depreciableBase.sub(runningAccumulated);
        }

        const nextAccumulated = runningAccumulated.add(depAmount);
        const closingBookValue = runningBookValue.sub(depAmount);

        if (period) {
          scheduleEntries.push({
            organizationId,
            assetId: asset.id,
            fiscalPeriodId: period.id,
            periodStart: period.startDate,
            periodEnd: period.endDate,
            openingBookValue: runningBookValue,
            depreciationAmount: depAmount,
            accumulatedDepreciation: nextAccumulated,
            closingBookValue,
            status: AssetDepreciationEntryStatus.SCHEDULED,
          });
        }

        runningAccumulated = nextAccumulated;
        runningBookValue = closingBookValue;
      }

      if (scheduleEntries.length > 0) {
        await tx.assetDepreciationEntry.createMany({
          data: scheduleEntries,
        });
      }

      const updatedAsset = await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          status: targetStatus,
          capitalizedAt: new Date(),
          capitalizedByUserId: userId,
          capitalizationJournalEntryId: journal.id,
          assetAccountId,
        },
        include: {
          category: true,
          capitalizationJournalEntry: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'ASSET_CAPITALIZED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'asset.capitalized',
        resource: 'fixed_asset',
        resourceId: updatedAsset.id,
        details: {
          assetNumber: updatedAsset.assetNumber,
          journalEntryId: journal.id,
        },
      });

      if (targetStatus === FixedAssetStatus.ACTIVE) {
        await this.eventBus.publish({
          eventName: 'ASSET_ACTIVATED',
          occurredAt: new Date(),
          organizationId,
          actorUserId: userId,
          action: 'asset.activated',
          resource: 'fixed_asset',
          resourceId: updatedAsset.id,
          details: {
            assetNumber: updatedAsset.assetNumber,
          },
        });
      }

      return updatedAsset;
    });
  }

  async activate(
    organizationId: string,
    id: string,
    placedInServiceDate: string | undefined,
    userId: string,
  ) {
    const asset = await this.findOne(organizationId, id);

    if (
      asset.status !== FixedAssetStatus.CAPITALIZED &&
      asset.status !== FixedAssetStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot activate asset in status ${asset.status}. Asset must be CAPITALIZED or DRAFT.`,
      );
    }

    const inServiceDate = placedInServiceDate
      ? new Date(placedInServiceDate)
      : new Date();

    const updated = await this.prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        status: FixedAssetStatus.ACTIVE,
        placedInServiceDate: inServiceDate,
      },
      include: { category: true },
    });

    await this.eventBus.publish({
      eventName: 'ASSET_ACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'asset.activated',
      resource: 'fixed_asset',
      resourceId: updated.id,
      details: {
        assetNumber: updated.assetNumber,
      },
    });

    return updated;
  }

  async transfer(
    organizationId: string,
    id: string,
    dto: TransferFixedAssetDto,
    userId: string,
  ) {
    const asset = await this.findOne(organizationId, id);

    if (
      asset.status !== FixedAssetStatus.ACTIVE &&
      asset.status !== FixedAssetStatus.CAPITALIZED
    ) {
      throw new BadRequestException(
        `Cannot transfer asset in status ${asset.status}. Only ACTIVE or CAPITALIZED assets can be transferred.`,
      );
    }

    const toLocation = await this.prisma.location.findFirst({
      where: { id: dto.toLocationId, organizationId, deletedAt: null },
    });
    if (!toLocation) {
      throw new NotFoundException(
        `Destination location ${dto.toLocationId} not found in this organization.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const transferHistory = await tx.assetTransferHistory.create({
        data: {
          organizationId,
          assetId: asset.id,
          fromLocationId: asset.locationId,
          toLocationId: dto.toLocationId,
          transferDate: new Date(dto.transferDate),
          reason: dto.reason,
          transferredByUserId: userId,
        },
      });

      const updatedAsset = await tx.fixedAsset.update({
        where: { id: asset.id },
        data: { locationId: dto.toLocationId },
        include: { location: true, category: true },
      });

      await this.eventBus.publish({
        eventName: 'ASSET_TRANSFERRED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'asset.transferred',
        resource: 'fixed_asset',
        resourceId: updatedAsset.id,
        details: {
          assetNumber: updatedAsset.assetNumber,
          fromLocationId: asset.locationId,
          toLocationId: dto.toLocationId,
        },
      });

      return {
        asset: updatedAsset,
        transfer: transferHistory,
      };
    });
  }

  async void(organizationId: string, id: string, userId: string) {
    const asset = await this.findOne(organizationId, id);

    if (
      asset.status === FixedAssetStatus.DISPOSED ||
      asset.status === FixedAssetStatus.VOIDED
    ) {
      throw new BadRequestException(
        `Cannot void fixed asset in status ${asset.status}.`,
      );
    }

    const postedDepCount = await this.prisma.assetDepreciationEntry.count({
      where: {
        organizationId,
        assetId: asset.id,
        status: AssetDepreciationEntryStatus.POSTED,
      },
    });

    if (postedDepCount > 0) {
      throw new BadRequestException(
        `Cannot void fixed asset with ${postedDepCount} posted depreciation entries. Dispose the asset instead.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // If capitalized, post compensating reversal journal entry
      if (
        asset.status === FixedAssetStatus.CAPITALIZED ||
        asset.status === FixedAssetStatus.ACTIVE
      ) {
        const fiscalPeriod = await tx.fiscalPeriod.findFirst({
          where: {
            organizationId,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
            status: FiscalPeriodStatus.OPEN,
          },
        });

        if (fiscalPeriod && asset.assetAccountId) {
          const apAccountId = await this.accountMappingService.resolveAccount(
            organizationId,
            'ACCOUNTS_PAYABLE',
          );
          const journalNumber = await this.numberingService.nextNumber(
            organizationId,
            'JOURNAL_ENTRY',
          );

          await tx.journalEntry.create({
            data: {
              organizationId,
              fiscalPeriodId: fiscalPeriod.id,
              entryNumber: journalNumber.formatted,
              entryDate: new Date(),
              description: `Reversal of Capitalization for Fixed Asset ${asset.assetNumber}`,
              status: JournalEntryStatus.POSTED,
              sourceType: 'FIXED_ASSET_VOID',
              sourceId: asset.id,
              createdByUserId: userId,
              postedAt: new Date(),
              postedByUserId: userId,
              lines: {
                create: [
                  {
                    organizationId,
                    accountId: asset.assetAccountId,
                    lineNumber: 1,
                    debit: new Prisma.Decimal(0),
                    credit: asset.acquisitionCost,
                    description: `Reversal of Asset Capitalization - ${asset.name}`,
                  },
                  {
                    organizationId,
                    accountId: apAccountId,
                    lineNumber: 2,
                    debit: asset.acquisitionCost,
                    credit: new Prisma.Decimal(0),
                    description: `Reversal of AP/Acquisition Clearing - ${asset.name}`,
                  },
                ],
              },
            },
          });
        }
      }

      // Void scheduled depreciation entries
      await tx.assetDepreciationEntry.updateMany({
        where: {
          organizationId,
          assetId: asset.id,
          status: AssetDepreciationEntryStatus.SCHEDULED,
        },
        data: { status: AssetDepreciationEntryStatus.VOIDED },
      });

      const voided = await tx.fixedAsset.update({
        where: { id: asset.id },
        data: { status: FixedAssetStatus.VOIDED },
      });

      await this.eventBus.publish({
        eventName: 'ASSET_VOIDED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'asset.voided',
        resource: 'fixed_asset',
        resourceId: voided.id,
        details: {
          assetNumber: voided.assetNumber,
        },
      });

      return voided;
    });
  }
}
