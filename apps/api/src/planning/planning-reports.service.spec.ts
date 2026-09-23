import { Test, TestingModule } from '@nestjs/testing';
import { PlanningReportsService } from './planning-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlannedOrderAction, Prisma } from '@prisma/client';

describe('PlanningReportsService', () => {
  let service: PlanningReportsService;
  let prisma: any;

  const mockOrgId = 'org-rep-1';

  beforeEach(async () => {
    prisma = {
      planningResult: {
        findMany: jest.fn(),
      },
      planningDemand: {
        findMany: jest.fn(),
      },
      planningSupply: {
        findMany: jest.fn(),
      },
      plannedOrder: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PlanningReportsService>(PlanningReportsService);
  });

  it('should calculate MRP summary totals accurately', async () => {
    prisma.planningResult.findMany.mockResolvedValue([
      {
        id: 'res-1',
        planningRunId: 'run-1',
        grossRequirement: new Prisma.Decimal(100),
        availableQuantity: new Prisma.Decimal(40),
        expectedSupplyQuantity: new Prisma.Decimal(10),
        safetyStockQuantity: new Prisma.Decimal(20),
        netRequirement: new Prisma.Decimal(70),
        suggestedAction: PlannedOrderAction.PURCHASE,
        plannedOrderDate: new Date('2026-09-01'),
      },
    ]);

    const summary = await service.getSummary(mockOrgId, {});
    expect(summary.itemCount).toBe(1);
    expect(Number(summary.totalGrossDemand)).toBe(100);
    expect(Number(summary.totalNetRequirement)).toBe(70);
    expect(summary.purchaseRecommendations).toBe(1);
  });

  it('should query supply demand chronological breakdown', async () => {
    prisma.planningDemand.findMany.mockResolvedValue([
      { id: 'd-1', quantity: new Prisma.Decimal(50), requiredDate: new Date() },
    ]);
    prisma.planningSupply.findMany.mockResolvedValue([
      {
        id: 's-1',
        quantity: new Prisma.Decimal(30),
        availableDate: new Date(),
      },
    ]);

    const report = await service.getSupplyDemand(mockOrgId, {});
    expect(Number(report.totalDemandQuantity)).toBe(50);
    expect(Number(report.totalSupplyQuantity)).toBe(30);
  });
});
