import { SavedReportsService } from '../services/saved-reports.service';
import { DashboardsService } from '../services/dashboards.service';
import {
  ReportVisibility,
  ReportShareType,
  DashboardVisibility,
} from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('Analytics Security & Tenant Boundary (INV-506, INV-508, INV-512, INV-514)', () => {
  let savedReportsService: SavedReportsService;
  let dashboardsService: DashboardsService;
  let mockReportRepo: any;
  let mockDashboardRepo: any;
  let mockQueryEngine: any;

  beforeEach(() => {
    mockReportRepo = {
      findById: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addShare: jest.fn(),
      removeShare: jest.fn(),
    };

    mockDashboardRepo = {
      findById: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addShare: jest.fn(),
      removeShare: jest.fn(),
    };

    mockQueryEngine = {
      execute: jest.fn(),
    };

    savedReportsService = new SavedReportsService(
      mockReportRepo,
      mockQueryEngine,
    );
    dashboardsService = new DashboardsService(mockDashboardRepo);
  });

  describe('Saved Reports Security (INV-506, INV-508)', () => {
    it('INV-506: denies access to private report if caller is not owner and has no share grant', async () => {
      mockReportRepo.findById.mockResolvedValue({
        id: 'rep-1',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: ReportVisibility.PRIVATE,
        shares: [],
      });

      await expect(
        savedReportsService.getReport({
          id: 'rep-1',
          organizationId: 'org-1',
          userId: 'user-other',
          userRoles: [],
          userTeams: [],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('INV-508: allows access to private report if caller has explicit user share grant', async () => {
      mockReportRepo.findById.mockResolvedValue({
        id: 'rep-1',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: ReportVisibility.PRIVATE,
        shares: [
          {
            savedReportId: 'rep-1',
            shareType: ReportShareType.USER,
            targetId: 'user-shared',
          },
        ],
      });

      const report = await savedReportsService.getReport({
        id: 'rep-1',
        organizationId: 'org-1',
        userId: 'user-shared',
      });

      expect(report.id).toBe('rep-1');
    });

    it('INV-508: allows access to private report if caller belongs to shared role', async () => {
      mockReportRepo.findById.mockResolvedValue({
        id: 'rep-1',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: ReportVisibility.PRIVATE,
        shares: [
          {
            savedReportId: 'rep-1',
            shareType: ReportShareType.ROLE,
            targetId: 'FINANCE_MANAGER',
          },
        ],
      });

      const report = await savedReportsService.getReport({
        id: 'rep-1',
        organizationId: 'org-1',
        userId: 'user-finance',
        userRoles: ['FINANCE_MANAGER'],
      });

      expect(report.id).toBe('rep-1');
    });

    it('INV-508: prevents non-owner from sharing a report', async () => {
      mockReportRepo.findById.mockResolvedValue({
        id: 'rep-1',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: ReportVisibility.PRIVATE,
        shares: [],
      });

      await expect(
        savedReportsService.shareReport({
          savedReportId: 'rep-1',
          organizationId: 'org-1',
          userId: 'user-intruder',
          shareType: ReportShareType.USER,
          targetId: 'user-friend',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Dashboards Security (INV-512)', () => {
    it('INV-512: denies access to private dashboard for unauthorized users', async () => {
      mockDashboardRepo.findById.mockResolvedValue({
        id: 'dash-1',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: DashboardVisibility.PRIVATE,
        shares: [],
        widgets: [],
      });

      await expect(
        dashboardsService.getDashboard({
          id: 'dash-1',
          organizationId: 'org-1',
          userId: 'user-random',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('INV-512: allows organization-wide dashboard access across same tenant', async () => {
      mockDashboardRepo.findById.mockResolvedValue({
        id: 'dash-org',
        organizationId: 'org-1',
        ownerUserId: 'user-owner',
        visibility: DashboardVisibility.ORGANIZATION,
        shares: [],
        widgets: [],
      });

      const dashboard = await dashboardsService.getDashboard({
        id: 'dash-org',
        organizationId: 'org-1',
        userId: 'user-colleague',
      });

      expect(dashboard.id).toBe('dash-org');
    });

    it('INV-512: denies cross-tenant access when resource is in a different org', async () => {
      mockDashboardRepo.findById.mockResolvedValue(null);

      await expect(
        dashboardsService.getDashboard({
          id: 'dash-org-2',
          organizationId: 'org-1',
          userId: 'user-org1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
