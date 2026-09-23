import { Test, TestingModule } from '@nestjs/testing';
import { PlanningRunsService } from './planning-runs.service';
import { MrpEngineService } from './mrp-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PlanningRunStatus } from '@prisma/client';

describe('Planning Concurrency & Idempotency Tests (100 parallel workers)', () => {
  let service: PlanningRunsService;
  let prisma: any;
  let mrpEngine: any;

  const mockOrgId = 'org-concurrent-mrp';
  const mockUserId = 'user-concurrent';

  beforeEach(async () => {
    prisma = {
      planningRun: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      planningDemand: { createMany: jest.fn() },
      planningSupply: { createMany: jest.fn() },
      planningResult: { createMany: jest.fn() },
      plannedOrder: { createMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    mrpEngine = {
      executeCalculation: jest.fn().mockResolvedValue({
        demandSnapshots: [],
        supplySnapshots: [],
        planningResults: [],
        plannedOrders: [],
        totalShortages: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningRunsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: MrpEngineService, useValue: mrpEngine },
      ],
    }).compile();

    service = module.get<PlanningRunsService>(PlanningRunsService);
  });

  it('Scenario 1: 100 parallel execution requests on same draft run -> exactly 1 success, 99 rejected', async () => {
    let runStatus: PlanningRunStatus = PlanningRunStatus.DRAFT;

    prisma.$transaction.mockImplementation((cb: (tx: any) => Promise<any>) => {
      if (runStatus !== PlanningRunStatus.DRAFT) {
        throw new Error(
          `Cannot execute planning run in status ${String(runStatus)}. Must be in DRAFT status.`,
        );
      }
      runStatus = PlanningRunStatus.RUNNING;
      return cb({
        ...prisma,
        planningRun: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'run-1',
            runNumber: 'MRP-000001',
            status: PlanningRunStatus.DRAFT,
            startDate: new Date('2026-09-01'),
            endDate: new Date('2026-09-30'),
            includeSalesOrders: true,
            includeProductionOrders: true,
            includeSafetyStock: true,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'run-1',
            runNumber: 'MRP-000001',
            status: PlanningRunStatus.COMPLETED,
            totalResultCount: 0,
            totalPlannedOrderCount: 0,
          }),
        },
      });
    });

    const promises = Array.from({ length: 100 }, () =>
      service.execute(mockOrgId, 'run-1', mockUserId),
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);
  });
});
