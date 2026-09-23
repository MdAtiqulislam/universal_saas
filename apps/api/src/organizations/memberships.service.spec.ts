import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

describe('MembershipsService', () => {
  let service: MembershipsService;
  let prismaMock: any;

  const mockOrgId = 'org-1111-1111-1111';
  const mockRequesterUserId = 'user-requester-1111';
  const mockTargetUserId = 'user-target-2222';
  const mockMemberId = 'member-3333-3333';

  const mockRequesterMembership = {
    id: 'req-mem-1',
    organizationId: mockOrgId,
    userId: mockRequesterUserId,
    status: 'ACTIVE',
    deletedAt: null,
  };

  const mockTargetUser = {
    id: mockTargetUserId,
    email: 'invited@example.com',
    status: 'ACTIVE',
    deletedAt: null,
  };

  const mockTargetMember = {
    id: mockMemberId,
    organizationId: mockOrgId,
    userId: mockTargetUserId,
    status: 'INVITED',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    user: mockTargetUser,
  };

  beforeEach(async () => {
    prismaMock = {
      organizationMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      memberRole: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
  });

  describe('listMembers', () => {
    it('1. should list members for active organization member', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockRequesterMembership,
      );
      prismaMock.organizationMember.findMany.mockResolvedValue([
        mockTargetMember,
      ]);

      const result = await service.listMembers(mockOrgId, mockRequesterUserId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockMemberId);
      expect(result[0].user.email).toBe('invited@example.com');
    });
  });

  describe('addMember', () => {
    it('2. should invite a valid registered user to organization', async () => {
      prismaMock.organizationMember.findUnique
        .mockResolvedValueOnce(mockRequesterMembership) // Requester validation
        .mockResolvedValueOnce(null); // Existing target membership check

      prismaMock.user.findFirst.mockResolvedValue(mockTargetUser);
      prismaMock.organizationMember.create.mockResolvedValue(mockTargetMember);

      const result = await service.addMember(
        mockOrgId,
        { email: 'INVITED@EXAMPLE.COM' },
        mockRequesterUserId,
      );

      expect(result.id).toBe(mockMemberId);
      expect(result.status).toBe('INVITED');
      expect(prismaMock.organizationMember.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrgId,
          userId: mockTargetUserId,
          status: 'INVITED',
        },
        include: { user: true },
      });
    });

    it('3. should reject inviting non-existent email with 404 Not Found', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockRequesterMembership,
      );
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.addMember(
          mockOrgId,
          { email: 'unknown@example.com' },
          mockRequesterUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('4. should reject duplicate active membership with 409 Conflict', async () => {
      prismaMock.organizationMember.findUnique
        .mockResolvedValueOnce(mockRequesterMembership)
        .mockResolvedValueOnce({
          ...mockTargetMember,
          status: 'ACTIVE',
          deletedAt: null,
        });

      prismaMock.user.findFirst.mockResolvedValue(mockTargetUser);

      await expect(
        service.addMember(
          mockOrgId,
          { email: 'invited@example.com' },
          mockRequesterUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateMember (Scoped IDOR Protection)', () => {
    it('5. should update member status within the organization', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockRequesterMembership,
      );
      prismaMock.organizationMember.findFirst.mockResolvedValue(
        mockTargetMember,
      );
      prismaMock.organizationMember.update.mockResolvedValue({
        ...mockTargetMember,
        status: 'ACTIVE',
      });

      const result = await service.updateMember(
        mockOrgId,
        mockMemberId,
        { status: 'ACTIVE' },
        mockRequesterUserId,
      );

      expect(result.status).toBe('ACTIVE');
      // Verify query is strictly scoped by organizationId and id
      expect(prismaMock.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockMemberId,
          organizationId: mockOrgId,
          deletedAt: null,
        },
      });
    });

    it('6. should reject cross-tenant member update if member belongs to different org (IDOR Defense)', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockRequesterMembership,
      );
      // Member exists in DB but not in this organization
      prismaMock.organizationMember.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMember(
          mockOrgId,
          'foreign-member-id',
          { status: 'ACTIVE' },
          mockRequesterUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember (Soft Deletion & Scoped IDOR)', () => {
    it('7. should soft-delete member by setting SUSPENDED and deletedAt', async () => {
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        mockRequesterMembership,
      );
      prismaMock.organizationMember.findFirst.mockResolvedValue(
        mockTargetMember,
      );
      prismaMock.organizationMember.update.mockResolvedValue({
        ...mockTargetMember,
        status: 'SUSPENDED',
        deletedAt: new Date(),
      });

      const result = await service.removeMember(
        mockOrgId,
        mockMemberId,
        mockRequesterUserId,
      );

      expect(result).toEqual({
        success: true,
        message: 'Member removed from organization successfully',
      });
      expect(prismaMock.organizationMember.update).toHaveBeenCalledWith({
        where: { id: mockMemberId },
        data: {
          status: 'SUSPENDED',
          deletedAt: expect.any(Date),
        },
      });
    });
  });
});
