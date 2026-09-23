import { Test, TestingModule } from '@nestjs/testing';
import { PlanningRunsService } from './planning-runs.service';
import { MrpEngineService } from './mrp-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PlanningRunStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('PlanningRunsService', () => {
  let service: PlanningRunsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let mrpEngine: any;

  const mockOrgId = 'org-runs-1';
  const mockUserId = 'user-runs-1';

  beforeEach(async () => {
    prisma = {
      planningRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      planningDemand: { createMany: jest.fn() },
      planningSupply: { createMany: jest.fn() },
      planningResult: { createMany: jest.fn() },
      plannedOrder: { createMany: jest.fn() },
      location: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'MRP-000001' }),
    };

    mrpEngine = {
      executeCalculation: jest.fn().mockResolvedValue({
        demandSnapshots: [{ id: 'dem-1' }],
        supplySnapshots: [{ id: 'sup-1' }],
        planningResults: [{ id: 'res-1' }],
        plannedOrders: [{ id: 'ord-1' }],
        totalShortages: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningRunsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: MrpEngineService, useValue: mrpEngine },
      ],
    }).compile();

    service = module.get<PlanningRunsService>(PlanningRunsService);
  });

  describe('create', () => {
    it('should create a draft planning run with generated run number', async () => {
      prisma.planningRun.create.mockResolvedValue({
        id: 'run-1',
        runNumber: 'MRP-000001',
        name: 'September Planning Run',
        status: PlanningRunStatus.DRAFT,
      });

      const result = await service.create(
        mockOrgId,
        {
          name: 'September Planning Run',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
        },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(result.runNumber).toBe('MRP-000001');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'MRP_RUN_CREATED' }),
      );
    });

    it('should reject run if startDate is after endDate', async () => {
      await expect(
        service.create(
          mockOrgId,
          {
            name: 'Invalid Run',
            startDate: '2026-10-01',
            endDate: '2026-09-01',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('execute', () => {
    it('should transition DRAFT to COMPLETED and persist results', async () => {
      prisma.planningRun.findFirst.mockResolvedValue({
        id: 'run-1',
        runNumber: 'MRP-000001',
        status: PlanningRunStatus.DRAFT,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-30'),
        includeSalesOrders: true,
        includeProductionOrders: true,
        includeSafetyStock: true,
      });

      prisma.planningRun.update.mockResolvedValue({
        id: 'run-1',
        runNumber: 'MRP-000001',
        status: PlanningRunStatus.COMPLETED,
        totalResultCount: 1,
        totalPlannedOrderCount: 1,
      });

      const completed = await service.execute(mockOrgId, 'run-1', mockUserId);
      expect(completed.status).toBe(PlanningRunStatus.COMPLETED);
      expect(mrpEngine.executeCalculation).toHaveBeenCalled();
      expect(prisma.planningDemand.createMany).toHaveBeenCalled();
      expect(prisma.planningResult.createMany).toHaveBeenCalled();
      expect(prisma.plannedOrder.createMany).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'MRP_RUN_COMPLETED' }),
      );
    });

    it('should reject execution if run is not in DRAFT status', async () => {
      prisma.planningRun.findFirst.mockResolvedValue({
        id: 'run-1',
        status: PlanningRunStatus.COMPLETED,
      });

      await expect(
        service.execute(mockOrgId, 'run-1', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
