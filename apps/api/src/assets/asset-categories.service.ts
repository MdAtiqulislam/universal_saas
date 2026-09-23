import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AssetCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateAssetCategoryDto,
    userId?: string,
  ) {
    const existing = await this.prisma.assetCategory.findFirst({
      where: {
        organizationId,
        code: dto.code,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Asset category with code "${dto.code}" already exists in this organization.`,
      );
    }

    await this.validateAccounts(
      organizationId,
      dto.assetAccountId,
      dto.accumulatedDepreciationAccountId,
      dto.depreciationExpenseAccountId,
    );

    const category = await this.prisma.assetCategory.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        assetAccountId: dto.assetAccountId,
        accumulatedDepreciationAccountId: dto.accumulatedDepreciationAccountId,
        depreciationExpenseAccountId: dto.depreciationExpenseAccountId,
        depreciationMethod: dto.depreciationMethod ?? 'STRAIGHT_LINE',
        defaultUsefulLifeMonths: dto.defaultUsefulLifeMonths ?? 60,
        defaultResidualValuePercent:
          dto.defaultResidualValuePercent !== undefined
            ? new Prisma.Decimal(dto.defaultResidualValuePercent)
            : new Prisma.Decimal(0),
        isActive: dto.isActive ?? true,
      },
      include: {
        assetAccount: true,
        accumulatedDepreciationAccount: true,
        depreciationExpenseAccount: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'ASSET_CATEGORY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'asset_category.created',
      resource: 'asset_category',
      resourceId: category.id,
      details: {
        code: category.code,
        name: category.name,
      },
    });

    return category;
  }

  async findAll(organizationId: string, isActive?: boolean) {
    return this.prisma.assetCategory.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        assetAccount: true,
        accumulatedDepreciationAccount: true,
        depreciationExpenseAccount: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        assetAccount: true,
        accumulatedDepreciationAccount: true,
        depreciationExpenseAccount: true,
      },
    });
    if (!category) {
      throw new NotFoundException(`Asset category ${id} not found.`);
    }
    return category;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateAssetCategoryDto,
    userId?: string,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (dto.code && dto.code !== existing.code) {
      const duplicate = await this.prisma.assetCategory.findFirst({
        where: {
          organizationId,
          code: dto.code,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Asset category with code "${dto.code}" already exists.`,
        );
      }
    }

    await this.validateAccounts(
      organizationId,
      dto.assetAccountId,
      dto.accumulatedDepreciationAccountId,
      dto.depreciationExpenseAccountId,
    );

    const updated = await this.prisma.assetCategory.update({
      where: { id: existing.id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
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
        ...(dto.depreciationMethod
          ? { depreciationMethod: dto.depreciationMethod }
          : {}),
        ...(dto.defaultUsefulLifeMonths !== undefined
          ? { defaultUsefulLifeMonths: dto.defaultUsefulLifeMonths }
          : {}),
        ...(dto.defaultResidualValuePercent !== undefined
          ? {
              defaultResidualValuePercent: new Prisma.Decimal(
                dto.defaultResidualValuePercent,
              ),
            }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        assetAccount: true,
        accumulatedDepreciationAccount: true,
        depreciationExpenseAccount: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'ASSET_CATEGORY_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'asset_category.updated',
      resource: 'asset_category',
      resourceId: updated.id,
      details: {
        code: updated.code,
      },
    });

    return updated;
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.findOne(organizationId, id);

    const assetCount = await this.prisma.fixedAsset.count({
      where: {
        organizationId,
        categoryId: id,
        deletedAt: null,
      },
    });
    if (assetCount > 0) {
      throw new BadRequestException(
        `Cannot delete asset category ${existing.code} because ${assetCount} active/assigned asset(s) reference it.`,
      );
    }

    return this.prisma.assetCategory.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async validateAccounts(
    organizationId: string,
    assetAccountId?: string,
    accumulatedDepAccountId?: string,
    depExpenseAccountId?: string,
  ) {
    const accountIds = [
      assetAccountId,
      accumulatedDepAccountId,
      depExpenseAccountId,
    ].filter(Boolean) as string[];

    if (accountIds.length === 0) return;

    const accounts = await this.prisma.account.findMany({
      where: {
        id: { in: accountIds },
        organizationId,
        deletedAt: null,
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new NotFoundException(
        'One or more specified GL accounts do not exist in this organization.',
      );
    }
  }
}
