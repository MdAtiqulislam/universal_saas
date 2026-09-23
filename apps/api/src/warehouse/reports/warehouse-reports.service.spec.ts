import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseReportsService } from './warehouse-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, PickTaskStatus, WarehouseTaskStatus } from '@prisma/client';

describe('WarehouseReportsService', () => {
  let service: WarehouseReportsService;
  let prisma: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      inventoryBalance: { findMany: jest.fn() },
      location: { findMany: jest.fn() },
      warehouseTask: { findMany: jest.fn() },
      putawayTask: { findMany: jest.fn() },
      pickTask: { findMany: jest.fn() },
      cycleCountLine: { findMany: jest.fn() },
      quarantineRecord: { findMany: jest.fn() },
      replenishmentTask: { findMany: jest.fn() },
      warehouseTransfer: { findMany: jest.fn() },
      pickTaskLine: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WarehouseReportsService>(WarehouseReportsService);
  });

  it('should calculate accuracy rate report correctly', async () => {
    prisma.cycleCountLine.findMany.mockResolvedValue([
      { varianceQuantity: new Prisma.Decimal('0') },
      { varianceQuantity: new Prisma.Decimal('0') },
      { varianceQuantity: new Prisma.Decimal('1.0000') }, // mismatch
      { varianceQuantity: new Prisma.Decimal('0') },
    ]);

    const result = await service.getInventoryAccuracyRate(mockOrgId, {});
    expect(result.totalLinesCounted).toBe(4);
    expect(result.exactMatchLines).toBe(3);
    expect(result.accuracyRatePercentage).toBe(75);
  });

  it('should generate task performance report correctly', async () => {
    prisma.warehouseTask.findMany.mockResolvedValue([
      { status: WarehouseTaskStatus.COMPLETED },
      { status: WarehouseTaskStatus.IN_PROGRESS },
    ]);
    prisma.putawayTask.findMany.mockResolvedValue([
      { status: WarehouseTaskStatus.COMPLETED },
      { status: WarehouseTaskStatus.COMPLETED },
    ]);
    prisma.pickTask.findMany.mockResolvedValue([
      { status: PickTaskStatus.PICKED },
      { status: PickTaskStatus.PARTIALLY_PICKED },
    ]);

    const result = await service.getTaskPerformance(mockOrgId, {});
    expect(result.putawayMetrics.completionRate).toBe(100);
    expect(result.pickingMetrics.completionRate).toBe(50);
  });
});
