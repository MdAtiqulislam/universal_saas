import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SavedViewsService } from '../services/saved-views.service';
import { SavedViewsRepository } from '../repositories/saved-views.repository';
import { FilterAstEngineService } from '../services/filter-ast-engine.service';
import { AuditService } from '../../audit/audit.service';
import { SavedViewVisibility, SavedViewShareType } from '@prisma/client';

describe('SavedViewsService', () => {
  let service: SavedViewsService;
  let savedViewsRepo: jest.Mocked<SavedViewsRepository>;
  let filterEngine: jest.Mocked<FilterAstEngineService>;
  let audit: jest.Mocked<AuditService>;
  let prisma: any;

  beforeEach(() => {
    savedViewsRepo = {
      findSavedViewByName: jest.fn(),
      findSavedViewById: jest.fn(),
      createSavedView: jest.fn(),
      updateSavedView: jest.fn(),
      deleteSavedView: jest.fn(),
      addShare: jest.fn(),
      removeShare: jest.fn(),
      listAccessibleSavedViews: jest.fn(),
    } as any;

    filterEngine = {
      validateAst: jest.fn(),
      evaluate: jest.fn(),
    } as any;

    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;

    prisma = {
      organizationMember: {
        findFirst: jest.fn(),
      },
    };

    service = new SavedViewsService(
      savedViewsRepo,
      filterEngine,
      audit,
      prisma,
    );
  });

  describe('getSavedView (INV-491)', () => {
    it('allows owner to access their personal saved view', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        visibility: SavedViewVisibility.PERSONAL,
        name: 'My Personal View',
      } as any);

      const result = await service.getSavedView('view-1', 'org-1', 'user-1');
      expect(result.id).toBe('view-1');
    });

    it('denies non-owner access to personal saved view (INV-491)', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        visibility: SavedViewVisibility.PERSONAL,
        name: 'My Personal View',
      } as any);

      await expect(
        service.getSavedView('view-1', 'org-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if view does not exist in tenant', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue(null);

      await expect(
        service.getSavedView('nonexistent', 'org-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('shareSavedView (INV-492)', () => {
    it('allows sharing with active member of the same tenant', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        visibility: SavedViewVisibility.PERSONAL,
      } as any);

      prisma.organizationMember.findFirst.mockResolvedValue({
        id: 'member-2',
        userId: 'user-2',
        organizationId: 'org-1',
      });

      savedViewsRepo.addShare.mockResolvedValue({
        id: 'share-1',
        savedViewId: 'view-1',
      } as any);

      savedViewsRepo.updateSavedView.mockResolvedValue({} as any);

      const result = await service.shareSavedView('view-1', 'org-1', 'user-1', {
        shareType: SavedViewShareType.USER,
        targetId: 'user-2',
        permission: 'VIEW',
      });

      expect(result.id).toBe('share-1');
      expect(prisma.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          userId: 'user-2',
          status: 'ACTIVE',
        },
      });
    });

    it('rejects sharing with user outside the organization (INV-492)', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        visibility: SavedViewVisibility.PERSONAL,
      } as any);

      prisma.organizationMember.findFirst.mockResolvedValue(null);

      await expect(
        service.shareSavedView('view-1', 'org-1', 'user-1', {
          shareType: SavedViewShareType.USER,
          targetId: 'user-external',
          permission: 'VIEW',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows sharing with valid role in same tenant (INV-492)', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        visibility: SavedViewVisibility.PERSONAL,
      } as any);

      prisma.role = {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'role-1', organizationId: 'org-1' }),
      };

      savedViewsRepo.addShare.mockResolvedValue({
        id: 'share-role-1',
        savedViewId: 'view-1',
      } as any);
      savedViewsRepo.updateSavedView.mockResolvedValue({} as any);

      const result = await service.shareSavedView('view-1', 'org-1', 'user-1', {
        shareType: SavedViewShareType.ROLE,
        targetId: 'role-1',
        permission: 'VIEW',
      });

      expect(result.id).toBe('share-role-1');
    });

    it('rejects sharing with role outside organization (INV-492)', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-1',
        organizationId: 'org-1',
        ownerUserId: 'user-1',
        visibility: SavedViewVisibility.PERSONAL,
      } as any);

      prisma.role = { findFirst: jest.fn().mockResolvedValue(null) };

      await expect(
        service.shareSavedView('view-1', 'org-1', 'user-1', {
          shareType: SavedViewShareType.ROLE,
          targetId: 'role-foreign',
          permission: 'VIEW',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ROLE-based access in getSavedView (INV-491)', () => {
    it('grants access if saved view is shared with caller role', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-shared-role',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: SavedViewVisibility.SHARED,
        shares: [
          { shareType: SavedViewShareType.ROLE, targetId: 'role-analyst' },
        ],
      } as any);

      prisma.organizationMember.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-caller',
        organizationId: 'org-1',
        memberRoles: [{ roleId: 'role-analyst' }],
      });

      const result = await service.getSavedView(
        'view-shared-role',
        'org-1',
        'user-caller',
      );
      expect(result.id).toBe('view-shared-role');
    });

    it('denies access if caller does not possess the shared role', async () => {
      savedViewsRepo.findSavedViewById.mockResolvedValue({
        id: 'view-shared-role',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: SavedViewVisibility.SHARED,
        shares: [
          { shareType: SavedViewShareType.ROLE, targetId: 'role-executive' },
        ],
      } as any);

      prisma.organizationMember.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-caller',
        organizationId: 'org-1',
        memberRoles: [{ roleId: 'role-analyst' }],
      });

      await expect(
        service.getSavedView('view-shared-role', 'org-1', 'user-caller'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
