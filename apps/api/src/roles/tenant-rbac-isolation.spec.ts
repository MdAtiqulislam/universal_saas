import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '../auth/authorization.service';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

describe('Tenant RBAC Isolation & Dynamic Authorization', () => {
  let authService: AuthorizationService;
  let rolesService: RolesService;
  let prismaMock: any;

  const userAlice = 'alice-user-uuid-1111';

  const orgAlpha = 'org-alpha-uuid-aaaa';
  const orgBeta = 'org-beta-uuid-bbbb';

  const adminRole = {
    id: 'admin-role-uuid',
    name: 'ADMIN',
    isSystem: true,
    organizationId: null,
    rolePermissions: [
      { permission: { name: 'users.view' } },
      { permission: { name: 'users.manage' } },
      { permission: { name: 'roles.view' } },
    ],
  };

  const viewerRole = {
    id: 'viewer-role-uuid',
    name: 'VIEWER',
    isSystem: true,
    organizationId: null,
    rolePermissions: [
      { permission: { name: 'users.view' } },
      { permission: { name: 'roles.view' } },
    ],
  };

  const aliceMembershipInAlpha = {
    id: 'mem-alice-alpha',
    userId: userAlice,
    organizationId: orgAlpha,
    status: 'ACTIVE',
    deletedAt: null,
    organization: { id: orgAlpha, status: 'ACTIVE', deletedAt: null },
    memberRoles: [{ role: adminRole }],
  };

  const aliceMembershipInBeta = {
    id: 'mem-alice-beta',
    userId: userAlice,
    organizationId: orgBeta,
    status: 'ACTIVE',
    deletedAt: null,
    organization: { id: orgBeta, status: 'ACTIVE', deletedAt: null },
    memberRoles: [{ role: viewerRole }],
  };

  beforeEach(async () => {
    prismaMock = {
      organizationMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorizationService,
        RolesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    authService = module.get<AuthorizationService>(AuthorizationService);
    rolesService = module.get<RolesService>(RolesService);
  });

  describe('Tenant-Specific Permission Isolation', () => {
    it("1. Alice has 'users.manage' in Org Alpha where she is ADMIN", async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        aliceMembershipInAlpha,
      );

      const canManageUsers = await authService.hasPermission(
        userAlice,
        orgAlpha,
        'users.manage',
      );

      expect(canManageUsers).toBe(true);
    });

    it("2. Alice DOES NOT have 'users.manage' in Org Beta where she is VIEWER (Cross-Tenant Authorization Isolation)", async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        aliceMembershipInBeta,
      );

      const canManageUsers = await authService.hasPermission(
        userAlice,
        orgBeta,
        'users.manage',
      );

      expect(canManageUsers).toBe(false);
    });

    it('3. Custom role created in Org Alpha cannot be accessed or assigned in Org Beta', async () => {
      // Role exists in Org Alpha
      prismaMock.role.findFirst.mockResolvedValue(null); // When queried with orgBeta scope, returns null

      await expect(
        rolesService.getRole('custom-role-alpha-id', orgBeta),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
