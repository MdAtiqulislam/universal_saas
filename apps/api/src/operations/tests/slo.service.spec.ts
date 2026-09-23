import { Test, TestingModule } from '@nestjs/testing';
import { SloService } from '../slo/slo.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SloScope, SloStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('M38: Service Level Objectives (INV-348, INV-349, INV-350)', () => {
  let sloService: SloService;
  let prismaMock: any;
  let auditMock: any;

  const mockOrgId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    prismaMock = {
      serviceLevelObjective: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'slo-uuid-1',
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
          }),
        ),
      },
    };
    auditMock = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SloService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    sloService = module.get<SloService>(SloService);
  });

  describe('SLO Creation & Validation (INV-348)', () => {
    it('1. should create a valid percentage SLO', async () => {
      const slo = await sloService.createSlo({
        name: 'API Availability 99.9%',
        metricKey: 'api_uptime_percentage',
        scope: SloScope.TENANT,
        targetValue: 99.9,
        unit: 'percent',
        windowDays: 30,
        organizationId: mockOrgId,
      });

      expect(slo.status).toBe(SloStatus.HEALTHY);
      expect(slo.currentValue).toBe(100);
      expect(slo.targetValue).toBe(99.9);
    });

    it('2. should reject percentage SLO with target > 100 or < 0 (INV-348)', async () => {
      await expect(
        sloService.createSlo({
          name: 'Invalid SLO',
          metricKey: 'invalid_metric',
          scope: SloScope.PLATFORM,
          targetValue: 150,
          unit: 'percent',
          windowDays: 30,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Deterministic Compliance Calculation (INV-349)', () => {
    it('3. should update SLO status to BREACHED when value drops below target and increment breachCount', async () => {
      prismaMock.serviceLevelObjective.findUnique.mockResolvedValueOnce({
        id: 'slo-1',
        targetValue: 99.5,
        status: SloStatus.HEALTHY,
        breachCount: 0,
      });

      const updated = await sloService.updateSloValue('slo-1', 98.2);
      expect(updated.status).toBe(SloStatus.BREACHED);
      expect(updated.breachCount).toBe(1);
    });

    it('4. should update SLO status to AT_RISK when within 5% buffer above target', async () => {
      prismaMock.serviceLevelObjective.findUnique.mockResolvedValueOnce({
        id: 'slo-1',
        targetValue: 90.0,
        status: SloStatus.HEALTHY,
        breachCount: 0,
      });

      const updated = await sloService.updateSloValue('slo-1', 92.0); // Within 90 * 1.05 = 94.5
      expect(updated.status).toBe(SloStatus.AT_RISK);
    });
  });

  describe('Tenant Scoping & Isolation (INV-350)', () => {
    it('5. should filter SLOs by tenant organizationId', async () => {
      await sloService.listSlos(mockOrgId, SloScope.TENANT);
      expect(prismaMock.serviceLevelObjective.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          scope: SloScope.TENANT,
        },
      });
    });
  });
});
