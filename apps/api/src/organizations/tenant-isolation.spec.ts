import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { TenantContextGuard } from './guards/tenant-context.guard';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

describe('Tenant Isolation & Multi-Organization Switching', () => {
  let orgsService: OrganizationsService;
  let guard: TenantContextGuard;
  let prismaMock: any;

  const userAlice = 'alice-user-uuid-1111';

  const orgA = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Org Alpha',
    slug: 'org-alpha',
    status: 'ACTIVE',
    deletedAt: null,
  };

  const orgB = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Org Beta',
    slug: 'org-beta',
    status: 'ACTIVE',
    deletedAt: null,
  };

  const orgC = {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Org Charlie',
    slug: 'org-charlie',
    status: 'ACTIVE',
    deletedAt: null,
  };

  const membershipAliceInA = {
    id: 'mem-alice-a',
    organizationId: orgA.id,
    userId: userAlice,
    status: 'ACTIVE',
    deletedAt: null,
  };

  const membershipAliceInB = {
    id: 'mem-alice-b',
    organizationId: orgB.id,
    userId: userAlice,
    status: 'ACTIVE',
    deletedAt: null,
  };

  const createMockContext = (
    userId: string,
    orgId?: string,
  ): { context: ExecutionContext; req: any } => {
    const req: any = {
      user: { id: userId },
      headers: orgId ? { 'x-organization-id': orgId } : {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
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
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        TenantContextGuard,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    orgsService = module.get<OrganizationsService>(OrganizationsService);
    guard = module.get<TenantContextGuard>(TenantContextGuard);
  });

  describe('Multi-Tenant Coexistence and Context Switching', () => {
    it('1. Alice can list both Org Alpha and Org Beta where she holds active memberships', async () => {
      prismaMock.organizationMember.findMany.mockResolvedValue([
        { organization: orgA },
        { organization: orgB },
      ]);

      const orgs = await orgsService.listUserOrganizations(userAlice);

      expect(orgs).toHaveLength(2);
      expect(orgs.map((o) => o.slug)).toEqual(['org-alpha', 'org-beta']);
    });

    it('2. Alice can establish tenant context for Org Alpha', async () => {
      const { context, req } = createMockContext(userAlice, orgA.id);

      prismaMock.organization.findUnique.mockResolvedValue(orgA);
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        membershipAliceInA,
      );

      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(req.tenantContext).toEqual({
        organizationId: orgA.id,
        membershipId: membershipAliceInA.id,
        userId: userAlice,
      });
    });

    it('3. Alice can switch tenant context to Org Beta', async () => {
      const { context, req } = createMockContext(userAlice, orgB.id);

      prismaMock.organization.findUnique.mockResolvedValue(orgB);
      prismaMock.organizationMember.findUnique.mockResolvedValue(
        membershipAliceInB,
      );

      const canActivate = await guard.canActivate(context);

      expect(canActivate).toBe(true);
      expect(req.tenantContext).toEqual({
        organizationId: orgB.id,
        membershipId: membershipAliceInB.id,
        userId: userAlice,
      });
    });

    it('4. Alice is rejected with 403 when attempting to access Org Charlie (cross-tenant unauthorized)', async () => {
      const { context } = createMockContext(userAlice, orgC.id);

      prismaMock.organization.findUnique.mockResolvedValue(orgC);
      prismaMock.organizationMember.findUnique.mockResolvedValue(null); // No membership for Alice in C

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("5. If Alice's membership in Org Alpha is suspended, tenant access is immediately rejected", async () => {
      const { context } = createMockContext(userAlice, orgA.id);

      prismaMock.organization.findUnique.mockResolvedValue(orgA);
      prismaMock.organizationMember.findUnique.mockResolvedValue({
        ...membershipAliceInA,
        status: 'SUSPENDED',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('6. If Org Beta is archived/deleted, tenant access is immediately rejected', async () => {
      const { context } = createMockContext(userAlice, orgB.id);

      prismaMock.organization.findUnique.mockResolvedValue({
        ...orgB,
        status: 'ARCHIVED',
        deletedAt: new Date(),
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
