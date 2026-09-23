import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SavedViewsRepository } from '../repositories/saved-views.repository';
import { FilterAstEngineService } from './filter-ast-engine.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateSavedViewDto,
  UpdateSavedViewDto,
  QuerySavedViewsDto,
} from '../dto/saved-view.dto';
import { CreateSavedViewShareDto } from '../dto/saved-view-share.dto';
import { SavedViewVisibility, SavedViewShareType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SavedViewsService {
  constructor(
    private readonly savedViewsRepo: SavedViewsRepository,
    private readonly filterEngine: FilterAstEngineService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates a saved view with AST validation and ownership
   */
  async createSavedView(
    organizationId: string,
    ownerUserId: string,
    dto: CreateSavedViewDto,
    actorUserId?: string,
  ) {
    // Check name uniqueness per organization and owner
    const existing = await this.savedViewsRepo.findSavedViewByName(
      organizationId,
      ownerUserId,
      dto.name,
    );
    if (existing) {
      throw new ConflictException(
        `Saved view with name '${dto.name}' already exists for this user`,
      );
    }

    // INV-493: Validate filter AST bounds and operators
    if (dto.filters) {
      this.filterEngine.validateAst(dto.filters as any);
    }

    const savedView = await this.savedViewsRepo.createSavedView({
      organizationId,
      ownerUserId,
      dto,
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'search.saved_view.created',
        organizationId,
        actorUserId,
        resource: 'saved_view',
        resourceId: savedView.id,
        details: {
          name: dto.name,
          resourceType: dto.resourceType,
          visibility: dto.visibility,
        },
        eventName: 'search.saved_view.created',
        occurredAt: new Date(),
      });
    }

    return savedView;
  }

  /**
   * INV-491: Retrieves saved view enforcing personal vs shared vs tenant access rules
   */
  async getSavedView(id: string, organizationId: string, userId: string) {
    const view = await this.savedViewsRepo.findSavedViewById(
      id,
      organizationId,
    );
    if (!view) {
      throw new NotFoundException(`Saved view '${id}' not found`);
    }

    // INV-491: Personal views accessible only by owner
    if (
      view.visibility === SavedViewVisibility.PERSONAL &&
      view.ownerUserId !== userId
    ) {
      throw new ForbiddenException(
        'Personal saved views are accessible only by their owner (INV-491)',
      );
    }

    // Shared views: verify caller is owner or explicitly shared
    if (
      view.visibility === SavedViewVisibility.SHARED &&
      view.ownerUserId !== userId
    ) {
      const sharesObj = view as unknown as {
        shares?: Array<{ shareType: SavedViewShareType; targetId: string }>;
      };
      const shares = sharesObj.shares || [];
      const isSharedWithUser = shares.some(
        (s) => s.shareType === SavedViewShareType.USER && s.targetId === userId,
      );
      if (!isSharedWithUser) {
        // Check if shared via ROLE
        const roleShares = shares.filter(
          (s) => s.shareType === SavedViewShareType.ROLE,
        );
        let isSharedWithRole = false;
        if (roleShares.length > 0) {
          const membership = await this.prisma.organizationMember.findFirst({
            where: { organizationId, userId, status: 'ACTIVE' },
            include: { memberRoles: true },
          });
          const userRoleIds: string[] =
            membership?.memberRoles?.map(
              (mr: { roleId: string }) => mr.roleId,
            ) || [];
          isSharedWithRole = roleShares.some((s) =>
            userRoleIds.includes(s.targetId),
          );
        }
        if (!isSharedWithRole) {
          throw new ForbiddenException(
            'Access to this shared saved view has not been granted (INV-491)',
          );
        }
      }
    }

    return view;
  }

  /**
   * Lists views accessible by user based on visibility
   */
  async listAccessibleSavedViews(
    organizationId: string,
    userId: string,
    query: QuerySavedViewsDto,
  ) {
    return this.savedViewsRepo.listAccessibleSavedViews({
      organizationId,
      userId,
      resourceType: query.resourceType,
      scope: query.scope,
      visibility: query.visibility,
    });
  }

  /**
   * Updates saved view (only owner can modify)
   */
  async updateSavedView(
    id: string,
    organizationId: string,
    userId: string,
    dto: UpdateSavedViewDto,
    actorUserId?: string,
  ) {
    const view = await this.getSavedView(id, organizationId, userId);

    if (view.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the owner of a saved view can modify it',
      );
    }

    if (view.isLocked) {
      throw new BadRequestException('Cannot modify a locked saved view');
    }

    if (dto.filters) {
      this.filterEngine.validateAst(dto.filters as any);
    }

    const updated = await this.savedViewsRepo.updateSavedView(
      id,
      organizationId,
      dto,
    );

    if (actorUserId) {
      await this.audit.record({
        action: 'search.saved_view.updated',
        organizationId,
        actorUserId,
        resource: 'saved_view',
        resourceId: id,
        details: { changes: Object.keys(dto) },
        eventName: 'search.saved_view.updated',
        occurredAt: new Date(),
      });
    }

    return updated;
  }

  /**
   * Deletes a saved view (only owner can delete)
   */
  async deleteSavedView(
    id: string,
    organizationId: string,
    userId: string,
    actorUserId?: string,
  ) {
    const view = await this.getSavedView(id, organizationId, userId);

    if (view.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the owner of a saved view can delete it',
      );
    }

    await this.savedViewsRepo.deleteSavedView(id, organizationId);

    if (actorUserId) {
      await this.audit.record({
        action: 'search.saved_view.deleted',
        organizationId,
        actorUserId,
        resource: 'saved_view',
        resourceId: id,
        details: { name: view.name },
        eventName: 'search.saved_view.deleted',
        occurredAt: new Date(),
      });
    }

    return { success: true };
  }

  /**
   * INV-492: Shares a saved view with valid same-tenant principals only
   */
  async shareSavedView(
    id: string,
    organizationId: string,
    userId: string,
    dto: CreateSavedViewShareDto,
    actorUserId?: string,
  ) {
    const view = await this.getSavedView(id, organizationId, userId);

    if (view.ownerUserId !== userId) {
      throw new ForbiddenException('Only the owner can share this saved view');
    }

    // INV-492: Validate that target principal belongs to the SAME tenant
    if (dto.shareType === SavedViewShareType.USER) {
      const targetUser = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: dto.targetId,
          status: 'ACTIVE',
        },
      });
      if (!targetUser) {
        throw new BadRequestException(
          'Target user does not belong to this organization (INV-492)',
        );
      }
    } else if (dto.shareType === SavedViewShareType.ROLE) {
      const targetRole = await this.prisma.role.findFirst({
        where: {
          id: dto.targetId,
          OR: [{ organizationId }, { isSystem: true }],
        },
      });
      if (!targetRole) {
        throw new BadRequestException(
          'Target role does not belong to this organization (INV-492)',
        );
      }
    } else if (dto.shareType === SavedViewShareType.TEAM) {
      const targetDepartment = await this.prisma.department.findFirst({
        where: {
          id: dto.targetId,
          organizationId,
        },
      });
      if (!targetDepartment) {
        throw new BadRequestException(
          'Target department/team does not belong to this organization (INV-492)',
        );
      }
    }

    const share = await this.savedViewsRepo.addShare({
      savedViewId: id,
      organizationId,
      shareType: dto.shareType,
      targetId: dto.targetId,
      permission: dto.permission || 'VIEW',
    });

    // Automatically update view visibility to SHARED if it was PERSONAL
    if (view.visibility === SavedViewVisibility.PERSONAL) {
      await this.savedViewsRepo.updateSavedView(id, organizationId, {
        visibility: SavedViewVisibility.SHARED,
      });
    }

    if (actorUserId) {
      await this.audit.record({
        action: 'search.saved_view.shared',
        organizationId,
        actorUserId,
        resource: 'saved_view_share',
        resourceId: share.id,
        details: {
          savedViewId: id,
          shareType: dto.shareType,
          targetId: dto.targetId,
        },
        eventName: 'search.saved_view.shared',
        occurredAt: new Date(),
      });
    }

    return share;
  }

  async revokeShare(
    savedViewId: string,
    shareId: string,
    organizationId: string,
    userId: string,
    actorUserId?: string,
  ) {
    const view = await this.getSavedView(savedViewId, organizationId, userId);

    if (view.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the owner can revoke shares for this saved view',
      );
    }

    await this.savedViewsRepo.removeShare(shareId, organizationId);

    if (actorUserId) {
      await this.audit.record({
        action: 'search.saved_view.share_revoked',
        organizationId,
        actorUserId,
        resource: 'saved_view_share',
        resourceId: shareId,
        details: { savedViewId },
        eventName: 'search.saved_view.share_revoked',
        occurredAt: new Date(),
      });
    }

    return { success: true };
  }
}
