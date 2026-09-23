import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationSettingsService } from './organization-settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrganizationSettingsService', () => {
  let service: OrganizationSettingsService;
  let prismaMock: any;

  const mockOrgId = 'org-1111-1111-1111';
  const mockUserId = 'user-2222-2222-2222';

  const mockMembership = {
    id: 'mem-1',
    organizationId: mockOrgId,
    userId: mockUserId,
    status: 'ACTIVE',
    deletedAt: null,
  };

  const mockSettings = {
    id: 'settings-1',
    organizationId: mockOrgId,
    currency: 'USD',
    timezone: 'UTC',
    fiscalYearStart: 1,
    customFields: { industry: 'Manufacturing' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaMock = {
      organizationMember: {
        findUnique: jest.fn(),
      },
      organizationSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationSettingsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OrganizationSettingsService>(
      OrganizationSettingsService,
    );
  });

  describe('getSettings', () => {
    it('1. should return settings for active organization member', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockMembership,
      );
      prismaMock.organizationSetting.findUnique.mockResolvedValue(mockSettings);

      const result = await service.getSettings(mockOrgId, mockUserId);

      expect(result.currency).toBe('USD');
      expect(result.timezone).toBe('UTC');
    });

    it('2. should reject cross-tenant settings access for non-members', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getSettings(mockOrgId, 'foreign-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('3. should throw 404 if settings not found', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockMembership,
      );
      prismaMock.organizationSetting.findUnique.mockResolvedValue(null);

      await expect(service.getSettings(mockOrgId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSettings', () => {
    it('4. should update settings successfully', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockMembership,
      );
      prismaMock.organizationSetting.upsert.mockResolvedValue({
        ...mockSettings,
        currency: 'EUR',
        fiscalYearStart: 4,
      });

      const result = await service.updateSettings(
        mockOrgId,
        { currency: 'EUR', fiscalYearStart: 4 },
        mockUserId,
      );

      expect(result.currency).toBe('EUR');
      expect(result.fiscalYearStart).toBe(4);
    });
  });
});
