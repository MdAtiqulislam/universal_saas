import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from './authorization.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let prismaMock: any;

  const mockUserId = 'user-1111-1111';
  const mockOrgId = 'org-2222-2222';

  const mockPermissions = [
    { permission: { name: 'users.view' } },
    { permission: { name: 'users.manage' } },
  ];

  const mockAdminRole = {
    id: 'admin-role-id',
    name: 'ADMIN',
    isSystem: true,
    organizationId: null,
    rolePermissions: mockPermissions,
  };

  const mockMembership = {
    id: 'member-1',
    userId: mockUserId,
    organizationId: mockOrgId,
    status: 'ACTIVE',
    deletedAt: null,
    organization: {
      id: mockOrgId,
      status: 'ACTIVE',
      deletedAt: null,
    },
    memberRoles: [
      {
        role: mockAdminRole,
      },
    ],
  };

  beforeEach(async () => {
    prismaMock = {
      organizationMember: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
  });

  describe('getEffectivePermissions', () => {
    it('1. should return effective permissions for user with system role', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockMembership,
      );

      const perms = await service.getEffectivePermissions(
        mockUserId,
        mockOrgId,
      );

      expect(perms).toEqual(
        expect.arrayContaining(['users.view', 'users.manage']),
      );
    });

    it('2. should combine permissions from multiple assigned roles', async () => {
      const customRole = {
        id: 'custom-role-id',
        name: 'AUDITOR',
        isSystem: false,
        organizationId: mockOrgId,
        rolePermissions: [{ permission: { name: 'audit.view' } }],
      };

      prismaMock.organizationMember.findUnique.mockResolvedValue({
        ...mockMembership,
        memberRoles: [{ role: mockAdminRole }, { role: customRole }],
      });

      const perms = await service.getEffectivePermissions(
        mockUserId,
        mockOrgId,
      );

      expect(perms).toEqual(
        expect.arrayContaining(['users.view', 'users.manage', 'audit.view']),
      );
    });

    it('3. should ignore custom roles belonging to another organization (Cross-Tenant Defense)', async () => {
      const foreignCustomRole = {
        id: 'foreign-role-id',
        name: 'FOREIGN_ROLE',
        isSystem: false,
        organizationId: 'foreign-org-id', // Belongs to different tenant!
        rolePermissions: [{ permission: { name: 'roles.manage' } }],
      };

      prismaMock.organizationMember.findUnique.mockResolvedValue({
        ...mockMembership,
        memberRoles: [{ role: mockAdminRole }, { role: foreignCustomRole }],
      });

      const perms = await service.getEffectivePermissions(
        mockUserId,
        mockOrgId,
      );

      expect(perms).not.toContain('roles.manage');
    });

    it('4. should return empty array if membership is suspended or deleted', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue({
        ...mockMembership,
        status: 'SUSPENDED',
      });

      const perms = await service.getEffectivePermissions(
        mockUserId,
        mockOrgId,
      );

      expect(perms).toEqual([]);
    });
  });

  describe('hasPermission & hasPermissions', () => {
    it('5. should return true when user has requested permission', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockMembership,
      );

      const hasView = await service.hasPermission(
        mockUserId,
        mockOrgId,
        'users.view',
      );

      expect(hasView).toBe(true);
    });

    it('6. should return false when user lacks requested permission', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockMembership,
      );

      const hasBilling = await service.hasPermission(
        mockUserId,
        mockOrgId,
        'billing.manage',
      );

      expect(hasBilling).toBe(false);
    });

    it('7. should evaluate multiple permissions using strict AND semantics', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockMembership,
      );

      const hasBoth = await service.hasPermissions(mockUserId, mockOrgId, [
        'users.view',
        'users.manage',
      ]);
      const hasMissingOne = await service.hasPermissions(
        mockUserId,
        mockOrgId,
        ['users.view', 'billing.manage'],
      );

      expect(hasBoth).toBe(true);
      expect(hasMissingOne).toBe(false);
    });
  });
});
