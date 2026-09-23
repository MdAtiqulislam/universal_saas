import { Test, TestingModule } from '@nestjs/testing';
import { AuditQueryService } from './audit-query.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditQueryService', () => {
  let service: AuditQueryService;
  let prismaMock: any;

  const mockOrgId = 'org-1111-1111';

  const mockRecords = [
    {
      id: 'audit-1',
      organizationId: mockOrgId,
      actorUserId: 'user-1',
      actorUser: { id: 'user-1', email: 'admin@example.com' },
      action: 'role.create',
      resource: 'role',
      resourceId: 'role-1',
      details: { name: 'MANAGER' },
      ipAddress: '127.0.0.1',
      userAgent: 'Jest',
      createdAt: new Date('2026-08-28T10:00:00Z'),
    },
  ];

  beforeEach(async () => {
    prismaMock = {
      auditLog: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue(mockRecords),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditQueryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuditQueryService>(AuditQueryService);
  });

  it('1. should query audit logs strictly scoped to organizationId', async () => {
    const result = await service.list(mockOrgId, { page: 1, limit: 50 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: mockOrgId,
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      }),
    );
  });

  it('2. should cap maximum limit to 100', async () => {
    await service.list(mockOrgId, { page: 1, limit: 500 });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('3. should apply action and resource filters', async () => {
    await service.list(mockOrgId, {
      page: 1,
      limit: 20,
      action: 'role.create',
      resource: 'role',
    });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: mockOrgId,
          action: { equals: 'role.create', mode: 'insensitive' },
          resource: { equals: 'role', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('4. should apply date range filters', async () => {
    const from = '2026-08-01T00:00:00Z';
    const to = '2026-08-31T23:59:59Z';

    await service.list(mockOrgId, {
      page: 1,
      limit: 20,
      from,
      to,
    });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: mockOrgId,
          createdAt: {
            gte: new Date(from),
            lte: new Date(to),
          },
        }),
      }),
    );
  });
});
