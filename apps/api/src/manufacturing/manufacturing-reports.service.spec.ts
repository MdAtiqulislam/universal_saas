import { Test, TestingModule } from '@nestjs/testing';
import { ManufacturingReportsService } from './manufacturing-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductionOrderStatus, Prisma } from '@prisma/client';

describe('ManufacturingReportsService', () => {
  let service: ManufacturingReportsService;
  let prisma: any;

  const mockOrgId = 'org-123';

  beforeEach(async () => {
    prisma = {
      productionOrder: {
        findMany: jest.fn(),
      },
      productionMaterialIssue: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManufacturingReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ManufacturingReportsService>(
      ManufacturingReportsService,
    );
  });

  it('should generate production summary report accurately', async () => {
    prisma.productionOrder.findMany.mockResolvedValue([
      {
        id: 'mo-1',
        orderNumber: 'MO-000001',
        plannedQuantity: new Prisma.Decimal(10),
        producedQuantity: new Prisma.Decimal(10),
        scrapQuantity: new Prisma.Decimal(1),
        totalCost: new Prisma.Decimal(1000),
        unitCost: new Prisma.Decimal(100),
        status: ProductionOrderStatus.COMPLETED,
        plannedStartDate: new Date('2026-09-01'),
        plannedCompletionDate: new Date('2026-09-10'),
        item: { sku: 'PROD-1', name: 'Product 1' },
        location: { name: 'Main Plant' },
      },
    ]);

    const report = await service.getProductionSummary(mockOrgId, {});
    expect(report.orderCount).toBe(1);
    expect(Number(report.totalPlannedQuantity)).toBe(10);
    expect(Number(report.totalProducedQuantity)).toBe(10);
    expect(Number(report.totalScrapQuantity)).toBe(1);
    expect(Number(report.totalProductionCost)).toBe(1000);
    expect(report.statusBreakdown[ProductionOrderStatus.COMPLETED]).toBe(1);
  });

  it('should generate WIP report for active production orders', async () => {
    prisma.productionOrder.findMany.mockResolvedValue([
      {
        id: 'mo-2',
        orderNumber: 'MO-000002',
        plannedQuantity: new Prisma.Decimal(20),
        producedQuantity: new Prisma.Decimal(5),
        materialCost: new Prisma.Decimal(800),
        actualStartDate: new Date(),
        item: { sku: 'PROD-2', name: 'Product 2' },
        location: { name: 'Main Plant' },
        lines: [],
        materialIssues: [],
      },
    ]);

    const wipReport = await service.getWipReport(mockOrgId);
    expect(wipReport.activeWipOrderCount).toBe(1);
    expect(Number(wipReport.totalWipValuation)).toBe(800);
  });
});
