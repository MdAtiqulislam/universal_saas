import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantContextGuard } from './tenant-context.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('TenantContextGuard', () => {
  let guard: TenantContextGuard;
  let prismaMock: any;

  const validOrgId = '11111111-1111-1111-1111-111111111111';
  const validUserId = '22222222-2222-2222-2222-222222222222';
  const validMemberId = '33333333-3333-3333-3333-333333333333';

  const mockOrg = {
    id: validOrgId,
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'ACTIVE',
    deletedAt: null,
  };

  const mockMembership = {
    id: validMemberId,
    organizationId: validOrgId,
    userId: validUserId,
    status: 'ACTIVE',
    deletedAt: null,
  };

  const createMockContext = (
    user?: { id: string },
    headers?: Record<string, string>,
  ): { context: ExecutionContext; req: any } => {
    const req: any = {
      user,
      headers: headers || {},
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    return { context, req };
  };

  beforeEach(async () => {
    prismaMock = {
      organization: {
        findUnique: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantContextGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    guard = module.get<TenantContextGuard>(TenantContextGuard);
  });

  it('1. should reject when user authentication is missing', async () => {
    const { context } = createMockContext(undefined, {
      'x-organization-id': validOrgId,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('2. should reject when X-Organization-Id header is missing', async () => {
    const { context } = createMockContext({ id: validUserId }, {});

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('3. should reject when X-Organization-Id is not a valid UUID', async () => {
    const { context } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': 'invalid-non-uuid-string',
      },
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('4. should throw 404 when organization is not found', async () => {
    const { context } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': validOrgId,
      },
    );

    prismaMock.organization.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('5. should reject with 403 when user is not a member of the organization', async () => {
    const { context } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': validOrgId,
      },
    );

    prismaMock.organization.findUnique.mockResolvedValue(mockOrg);
    prismaMock.organizationMember.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('6. should reject with 403 when membership is in INVITED status', async () => {
    const { context } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': validOrgId,
      },
    );

    prismaMock.organization.findUnique.mockResolvedValue(mockOrg);
    prismaMock.organizationMember.findUnique.mockResolvedValue({
      ...mockMembership,
      status: 'INVITED',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('7. should reject with 403 when membership is in SUSPENDED status', async () => {
    const { context } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': validOrgId,
      },
    );

    prismaMock.organization.findUnique.mockResolvedValue(mockOrg);
    prismaMock.organizationMember.findUnique.mockResolvedValue({
      ...mockMembership,
      status: 'SUSPENDED',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('8. should reject with 403 when membership is soft-deleted', async () => {
    const { context } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': validOrgId,
      },
    );

    prismaMock.organization.findUnique.mockResolvedValue(mockOrg);
    prismaMock.organizationMember.findUnique.mockResolvedValue({
      ...mockMembership,
      deletedAt: new Date(),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('9. should reject with 403 when organization is SUSPENDED or ARCHIVED', async () => {
    const { context } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': validOrgId,
      },
    );

    prismaMock.organization.findUnique.mockResolvedValue({
      ...mockOrg,
      status: 'ARCHIVED',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('10. should allow request and attach TenantContext when active membership in active org', async () => {
    const { context, req } = createMockContext(
      { id: validUserId },
      {
        'x-organization-id': validOrgId,
      },
    );

    prismaMock.organization.findUnique.mockResolvedValue(mockOrg);
    prismaMock.organizationMember.findUnique.mockResolvedValue(mockMembership);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.tenantContext).toEqual({
      organizationId: validOrgId,
      membershipId: validMemberId,
      userId: validUserId,
    });
  });
});
