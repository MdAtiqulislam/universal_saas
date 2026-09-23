import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SavedViewVisibility,
  SavedViewShareType,
  SearchScope,
  Prisma,
} from '@prisma/client';
import { CreateSavedViewDto, UpdateSavedViewDto } from '../dto/saved-view.dto';

@Injectable()
export class SavedViewsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSavedView(params: {
    organizationId: string;
    ownerUserId: string;
    dto: CreateSavedViewDto;
  }) {
    const { organizationId, ownerUserId, dto } = params;

    return this.prisma.savedView.create({
      data: {
        organizationId,
        ownerUserId,
        name: dto.name,
        description: dto.description,
        resourceType: dto.resourceType,
        scope: dto.scope || SearchScope.GLOBAL,
        visibility: dto.visibility || SavedViewVisibility.PERSONAL,
        filters: dto.filters as unknown as Prisma.InputJsonValue,
        sorting: dto.sorting as unknown as Prisma.InputJsonValue,
        selectedColumns: dto.selectedColumns || [],
        searchText: dto.searchText,
        paginationDefaults:
          dto.paginationDefaults as unknown as Prisma.InputJsonValue,
        displayConfig: dto.displayConfig as unknown as Prisma.InputJsonValue,
        isDefault: dto.isDefault || false,
      },
      include: {
        shares: true,
      },
    });
  }

  async findSavedViewById(id: string, organizationId: string) {
    return this.prisma.savedView.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        shares: true,
        ownerUser: {
          select: { id: true, email: true },
        },
      },
    });
  }

  async findSavedViewByName(
    organizationId: string,
    ownerUserId: string,
    name: string,
  ) {
    return this.prisma.savedView.findUnique({
      where: {
        organizationId_ownerUserId_name: {
          organizationId,
          ownerUserId,
          name,
        },
      },
    });
  }

  async listAccessibleSavedViews(params: {
    organizationId: string;
    userId: string;
    userRoleIds?: string[];
    resourceType?: string;
    scope?: SearchScope;
    visibility?: SavedViewVisibility;
  }) {
    const {
      organizationId,
      userId,
      userRoleIds = [],
      resourceType,
      scope,
      visibility,
    } = params;

    const accessConditions: Prisma.SavedViewWhereInput[] = [
      // 1. Personal views owned by user
      {
        ownerUserId: userId,
        visibility: SavedViewVisibility.PERSONAL,
      },
      // 2. Tenant views
      {
        visibility: SavedViewVisibility.TENANT,
      },
      // 3. Shared views owned by user
      {
        ownerUserId: userId,
        visibility: SavedViewVisibility.SHARED,
      },
      // 4. Shared views explicitly shared with user
      {
        visibility: SavedViewVisibility.SHARED,
        shares: {
          some: {
            shareType: SavedViewShareType.USER,
            targetId: userId,
          },
        },
      },
      // 5. Shared views explicitly shared with user's role
      ...(userRoleIds.length > 0
        ? [
            {
              visibility: SavedViewVisibility.SHARED,
              shares: {
                some: {
                  shareType: SavedViewShareType.ROLE,
                  targetId: { in: userRoleIds },
                },
              },
            },
          ]
        : []),
    ];

    return this.prisma.savedView.findMany({
      where: {
        organizationId,
        ...(resourceType ? { resourceType } : {}),
        ...(scope ? { scope } : {}),
        ...(visibility ? { visibility } : {}),
        OR: accessConditions,
      },
      include: {
        shares: true,
        ownerUser: {
          select: { id: true, email: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async updateSavedView(
    id: string,
    organizationId: string,
    dto: UpdateSavedViewDto,
  ) {
    const data: Prisma.SavedViewUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      ...(dto.filters !== undefined
        ? { filters: dto.filters as Prisma.InputJsonValue }
        : {}),
      ...(dto.sorting !== undefined ? { sorting: dto.sorting } : {}),
      ...(dto.selectedColumns !== undefined
        ? { selectedColumns: dto.selectedColumns }
        : {}),
      ...(dto.searchText !== undefined ? { searchText: dto.searchText } : {}),
      ...(dto.paginationDefaults !== undefined
        ? {
            paginationDefaults: dto.paginationDefaults,
          }
        : {}),
      ...(dto.displayConfig !== undefined
        ? { displayConfig: dto.displayConfig as Prisma.InputJsonValue }
        : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.isLocked !== undefined ? { isLocked: dto.isLocked } : {}),
    };

    return this.prisma.savedView.update({
      where: { id },
      data,
      include: {
        shares: true,
      },
    });
  }

  async deleteSavedView(id: string, organizationId: string) {
    return this.prisma.savedView.deleteMany({
      where: { id, organizationId },
    });
  }

  async addShare(params: {
    savedViewId: string;
    organizationId: string;
    shareType: SavedViewShareType;
    targetId: string;
    permission?: string;
  }) {
    return this.prisma.savedViewShare.upsert({
      where: {
        savedViewId_shareType_targetId: {
          savedViewId: params.savedViewId,
          shareType: params.shareType,
          targetId: params.targetId,
        },
      },
      update: {
        permission: params.permission || 'VIEW',
      },
      create: {
        savedViewId: params.savedViewId,
        organizationId: params.organizationId,
        shareType: params.shareType,
        targetId: params.targetId,
        permission: params.permission || 'VIEW',
      },
    });
  }

  async removeShare(shareId: string, organizationId: string) {
    return this.prisma.savedViewShare.deleteMany({
      where: {
        id: shareId,
        organizationId,
      },
    });
  }
}
