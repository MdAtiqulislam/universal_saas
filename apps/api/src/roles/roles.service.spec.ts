import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

describe('RolesService', () => {
  let service: RolesService;
  let prismaMock: any;

  const mockOrgId = 'org-1111-1111-1111';
  const mockMemberId = 'member-2222-2222-2222';
  const mockRoleId = 'role-3333-3333-3333';

  const mockCustomRole = {
    id: mockRoleId,
    name: 'WAREHOUSE_MANAGER',
    description: 'Manages warehouse items',
    isSystem: false,
    organizationId: mockOrgId,
    rolePermissions: [{ permission: { name: 'users.view' } }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSystemRole = {
    id: 'system-owner-id',
    name: 'OWNER',
    description: 'System owner',
    isSystem: true,
    organizationId: null,
    rolePermissions: [{ permission: { name: 'organizations.manage' } }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaMock = {
      role: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
      rolePermission: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      organizationMember: {
        findFirst: jest.fn(),
      },
      memberRole: {
        count: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('createCustomRole', () => {
    it('1. should create custom role successfully with permissions', async () => {
      prismaMock.role.findFirst
        .mockResolvedValueOnce(null) // Duplicate name check
        .mockResolvedValueOnce(mockCustomRole); // getRole lookup
      prismaMock.permission.findMany.mockResolvedValue([
        { id: 'perm-1', name: 'users.view' },
      ]);

      const txMock = {
        role: {
          create: jest.fn().mockResolvedValue({ id: mockRoleId }),
        },
        rolePermission: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      prismaMock.$transaction.mockImplementation((callback: any) =>
        callback(txMock),
      );

      const result = await service.createCustomRole(
        {
          name: 'Warehouse_Manager',
          description: 'Manages warehouse items',
          permissions: ['users.view'],
        },
        mockOrgId,
      );

      expect(result.name).toBe('WAREHOUSE_MANAGER');
      expect(txMock.role.create).toHaveBeenCalledWith({
        data: {
          name: 'WAREHOUSE_MANAGER',
          description: 'Manages warehouse items',
          isSystem: false,
          organizationId: mockOrgId,
        },
      });
    });

    it('2. should reject creating role with protected system name', async () => {
      await expect(
        service.createCustomRole({ name: 'OWNER' }, mockOrgId),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should reject duplicate role name within organization', async () => {
      prismaMock.role.findFirst.mockResolvedValue(mockCustomRole);

      await expect(
        service.createCustomRole({ name: 'WAREHOUSE_MANAGER' }, mockOrgId),
      ).rejects.toThrow(ConflictException);
    });

    it('4. should reject unknown permissions', async () => {
      prismaMock.role.findFirst.mockResolvedValue(null);
      prismaMock.permission.findMany.mockResolvedValue([]); // No matching perms found

      await expect(
        service.createCustomRole(
          { name: 'TEST_ROLE', permissions: ['nonexistent.permission'] },
          mockOrgId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCustomRole & deleteCustomRole', () => {
    it('5. should update custom role name and description', async () => {
      prismaMock.role.findUnique.mockResolvedValue(mockCustomRole);
      prismaMock.role.findFirst
        .mockResolvedValueOnce(null) // Name collision check
        .mockResolvedValueOnce({
          ...mockCustomRole,
          name: 'LOGISTICS_MANAGER',
        }); // getRole lookup
      prismaMock.role.update.mockResolvedValue({
        ...mockCustomRole,
        name: 'LOGISTICS_MANAGER',
      });

      const result = await service.updateCustomRole(
        mockRoleId,
        { name: 'LOGISTICS_MANAGER' },
        mockOrgId,
      );

      expect(result.name).toBe('LOGISTICS_MANAGER');
    });

    it('6. should reject modifying system roles', async () => {
      prismaMock.role.findUnique.mockResolvedValue(mockSystemRole);

      await expect(
        service.updateCustomRole(
          'system-owner-id',
          { name: 'NEW_NAME' },
          mockOrgId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. should delete unassigned custom role', async () => {
      prismaMock.role.findUnique.mockResolvedValue(mockCustomRole);
      prismaMock.memberRole.count.mockResolvedValue(0); // 0 assigned members
      prismaMock.role.delete.mockResolvedValue(mockCustomRole);

      const result = await service.deleteCustomRole(mockRoleId, mockOrgId);

      expect(result).toEqual({
        success: true,
        message: 'Custom role deleted successfully',
      });
    });

    it('8. should prevent deleting custom role assigned to members', async () => {
      prismaMock.role.findUnique.mockResolvedValue(mockCustomRole);
      prismaMock.memberRole.count.mockResolvedValue(3); // 3 members hold this role

      await expect(
        service.deleteCustomRole(mockRoleId, mockOrgId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('member role assignment & Owner protection', () => {
    it('9. should assign role to organization member', async () => {
      prismaMock.organizationMember.findFirst.mockResolvedValue({
        id: mockMemberId,
        organizationId: mockOrgId,
      });
      prismaMock.role.findFirst.mockResolvedValue(mockCustomRole);
      prismaMock.memberRole.upsert.mockResolvedValue({
        memberId: mockMemberId,
        roleId: mockRoleId,
        role: mockCustomRole,
      });

      const result = await service.assignRoleToMember(
        mockOrgId,
        mockMemberId,
        mockRoleId,
      );

      expect(result.roleId).toBe(mockRoleId);
    });

    it('10. should remove role from member', async () => {
      prismaMock.organizationMember.findFirst.mockResolvedValue({
        id: mockMemberId,
        organizationId: mockOrgId,
      });
      prismaMock.role.findUnique.mockResolvedValue(mockCustomRole);
      prismaMock.memberRole.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeRoleFromMember(
        mockOrgId,
        mockMemberId,
        mockRoleId,
      );

      expect(result).toEqual({
        success: true,
        message: 'Role removed from member successfully',
      });
    });

    it('11. should prevent removing the last OWNER role from organization', async () => {
      prismaMock.organizationMember.findFirst.mockResolvedValue({
        id: mockMemberId,
        organizationId: mockOrgId,
      });
      prismaMock.role.findUnique.mockResolvedValue(mockSystemRole); // OWNER role
      prismaMock.memberRole.count.mockResolvedValue(0); // No other active owners!

      await expect(
        service.removeRoleFromMember(
          mockOrgId,
          mockMemberId,
          'system-owner-id',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
