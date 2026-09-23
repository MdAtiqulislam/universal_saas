import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prismaMock: any;

  const mockUserId = 'user-1111-1111-1111';
  const mockOrgId = 'org-2222-2222-2222';

  const mockOrg = {
    id: mockOrgId,
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockMember = {
    id: 'member-3333-3333-3333',
    organizationId: mockOrgId,
    userId: mockUserId,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaMock = {
      organization: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organizationSetting: {
        create: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      memberRole: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  describe('create', () => {
    it('1. should create organization, settings, member, and assign OWNER role inside a transaction', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);

      const txMock = {
        organization: {
          create: jest.fn().mockResolvedValue(mockOrg),
        },
        organizationSetting: {
          create: jest.fn().mockResolvedValue({ id: 'settings-id' }),
        },
        organizationMember: {
          create: jest.fn().mockResolvedValue(mockMember),
        },
        role: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'owner-role-id', name: 'OWNER' }),
          create: jest.fn(),
        },
        memberRole: {
          create: jest.fn().mockResolvedValue({ id: 'member-role-id' }),
        },
      };

      prismaMock.$transaction.mockImplementation((callback: any) =>
        callback(txMock),
      );

      const result = await service.create(
        { name: 'Acme Corp', slug: 'acme-corp' },
        mockUserId,
      );

      expect(result).toEqual({
        id: mockOrg.id,
        name: mockOrg.name,
        slug: mockOrg.slug,
        status: mockOrg.status,
        createdAt: mockOrg.createdAt,
        updatedAt: mockOrg.updatedAt,
      });

      expect(txMock.organization.create).toHaveBeenCalledWith({
        data: { name: 'Acme Corp', slug: 'acme-corp', status: 'ACTIVE' },
      });
      expect(txMock.organizationSetting.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrg.id,
          currency: 'USD',
          timezone: 'UTC',
          fiscalYearStart: 1,
        },
      });
      expect(txMock.organizationMember.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrg.id,
          userId: mockUserId,
          status: 'ACTIVE',
        },
      });
      expect(txMock.memberRole.create).toHaveBeenCalledWith({
        data: { memberId: mockMember.id, roleId: 'owner-role-id' },
      });
    });

    it('2. should reject duplicate organization slug with 409 Conflict', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(mockOrg);

      await expect(
        service.create({ name: 'Acme Corp', slug: 'acme-corp' }, mockUserId),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should rollback transaction if any sub-operation fails', async () => {
      prismaMock.organization.findUnique.mockResolvedValue(null);
      prismaMock.$transaction.mockRejectedValue(
        new Error('Database write error'),
      );

      await expect(
        service.create({ name: 'Acme Corp', slug: 'acme-corp' }, mockUserId),
      ).rejects.toThrow('Database write error');
    });
  });

  describe('listUserOrganizations', () => {
    it('4. should list only active organizations where user has active membership', async () => {
      prismaMock.organizationMember.findMany.mockResolvedValue([
        { organization: mockOrg },
      ]);

      const result = await service.listUserOrganizations(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockOrg.id);
      expect(prismaMock.organizationMember.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          status: 'ACTIVE',
          deletedAt: null,
          organization: {
            deletedAt: null,
            status: 'ACTIVE',
          },
        },
        include: { organization: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getOrganization', () => {
    it('5. should return organization for active member', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(mockMember);
      prismaMock.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await service.getOrganization(mockOrgId, mockUserId);

      expect(result.id).toBe(mockOrgId);
      expect(result.name).toBe('Acme Corp');
    });

    it('6. should reject cross-tenant access when user is not a member', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrganization(mockOrgId, 'unauthorized-user-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. should reject access to soft-deleted or archived organization', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(mockMember);
      prismaMock.organization.findUnique.mockResolvedValue({
        ...mockOrg,
        status: 'ARCHIVED',
        deletedAt: new Date(),
      });

      await expect(
        service.getOrganization(mockOrgId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateOrganization', () => {
    it('8. should update organization name and slug', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(mockMember);
      prismaMock.organization.findUnique
        .mockResolvedValueOnce(mockOrg) // Current org
        .mockResolvedValueOnce(null); // Slug check
      prismaMock.organization.update.mockResolvedValue({
        ...mockOrg,
        name: 'Acme Global',
        slug: 'acme-global',
      });

      const result = await service.updateOrganization(
        mockOrgId,
        { name: 'Acme Global', slug: 'acme-global' },
        mockUserId,
      );

      expect(result.name).toBe('Acme Global');
      expect(result.slug).toBe('acme-global');
    });
  });

  describe('softDeleteOrganization', () => {
    it('9. should soft delete organization by setting ARCHIVED and deletedAt', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(mockMember);
      prismaMock.organization.findUnique.mockResolvedValue(mockOrg);
      prismaMock.organization.update.mockResolvedValue({
        ...mockOrg,
        status: 'ARCHIVED',
        deletedAt: new Date(),
      });

      const result = await service.softDeleteOrganization(
        mockOrgId,
        mockUserId,
      );

      expect(result).toEqual({
        success: true,
        message: 'Organization archived successfully',
      });
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: mockOrgId },
        data: {
          status: 'ARCHIVED',
          deletedAt: expect.any(Date),
        },
      });
    });
  });
});
