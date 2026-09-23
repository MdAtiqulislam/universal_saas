import { Test, TestingModule } from '@nestjs/testing';
import { PlanningRunsService } from './planning-runs.service';
import { PlannedOrdersService } from './planned-orders.service';
import { PlanningConfigService } from './planning-config.service';
import { PlanningReportsService } from './planning-reports.service';
import { MrpEngineService } from './mrp-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { NotFoundException } from '@nestjs/common';
import { PlannedOrderStatus } from '@prisma/client';

describe('Tenant Planning Isolation Tests', () => {
  let runsService: PlanningRunsService;
  let plannedOrdersService: PlannedOrdersService;
  let configService: PlanningConfigService;
  let reportsService: PlanningReportsService;
  let prisma: any;

  const TENANT_A = 'tenant-plan-aaa';
  const TENANT_B = 'tenant-plan-bbb';
  const USER_A = 'user-a';

  beforeEach(async () => {
    prisma = {
      planningRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      plannedOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      planningConfiguration: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      itemPlanningProfile: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      planningResult: {
        findMany: jest.fn(),
      },
      location: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'MRP-001' }),
    };
    const mrpEngine = { executeCalculation: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningRunsService,
        PlannedOrdersService,
        PlanningConfigService,
        PlanningReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: MrpEngineService, useValue: mrpEngine },
      ],
    }).compile();

    runsService = module.get<PlanningRunsService>(PlanningRunsService);
    plannedOrdersService =
      module.get<PlannedOrdersService>(PlannedOrdersService);
    configService = module.get<PlanningConfigService>(PlanningConfigService);
    reportsService = module.get<PlanningReportsService>(PlanningReportsService);
  });

  describe('Planning Run Isolation', () => {
    it('Scenario 1: Tenant A cannot read Tenant B Planning Run', async () => {
      prisma.planningRun.findFirst.mockImplementation(({ where }: any) => {
        if (where.organizationId === TENANT_B && where.id === 'run-b') {
          return Promise.resolve({ id: 'run-b', organizationId: TENANT_B });
        }
        return Promise.resolve(null);
      });

      await expect(runsService.findOne(TENANT_A, 'run-b')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Scenario 2: Tenant A cannot execute Tenant B Planning Run', async () => {
      prisma.planningRun.findFirst.mockResolvedValue(null);

      await expect(
        runsService.execute(TENANT_A, 'run-b', USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 3: Tenant A cannot cancel Tenant B Planning Run', async () => {
      prisma.planningRun.findFirst.mockResolvedValue(null);

      await expect(
        runsService.cancel(TENANT_A, 'run-b', USER_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 4: Tenant A cannot create Planning Run with Tenant B location', async () => {
      prisma.location.findFirst.mockResolvedValue(null); // Location belongs to Tenant B, not A

      await expect(
        runsService.create(
          TENANT_A,
          {
            name: 'Cross-Tenant Run',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            locationId: 'loc-b',
          },
          USER_A,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 5: Tenant A cannot create Planning Run with Tenant B item', async () => {
      prisma.item.findFirst.mockResolvedValue(null); // Item belongs to Tenant B, not A

      await expect(
        runsService.create(
          TENANT_A,
          {
            name: 'Cross-Tenant Run',
            startDate: '2026-09-01',
            endDate: '2026-09-30',
            itemId: 'item-b',
          },
          USER_A,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Planned Order & Profile Isolation', () => {
    it('Scenario 6: Tenant A cannot read Tenant B Planned Order', async () => {
      prisma.plannedOrder.findFirst.mockResolvedValue(null);

      await expect(
        plannedOrdersService.findOne(TENANT_A, 'pln-b'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 7: Tenant A cannot update status of Tenant B Planned Order', async () => {
      prisma.plannedOrder.findFirst.mockResolvedValue(null);

      await expect(
        plannedOrdersService.updateStatus(
          TENANT_A,
          'pln-b',
          PlannedOrderStatus.ACCEPTED,
          USER_A,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 8: Tenant A cannot delete Tenant B Item Planning Profile', async () => {
      prisma.itemPlanningProfile.findFirst.mockResolvedValue(null);

      await expect(
        configService.deleteItemProfile(TENANT_A, 'profile-b'),
      ).rejects.toThrow(NotFoundException);
    });

    it('Scenario 9: Tenant A planned orders list is strictly filtered by organizationId', async () => {
      prisma.plannedOrder.findMany.mockImplementation(({ where }: any) => {
        expect(where.organizationId).toBe(TENANT_A);
        return Promise.resolve([]);
      });

      await plannedOrdersService.findAll(TENANT_A, {});
    });

    it('Scenario 10: Tenant A reports only query Tenant A planning data', async () => {
      prisma.planningResult.findMany.mockImplementation(({ where }: any) => {
        expect(where.organizationId).toBe(TENANT_A);
        return Promise.resolve([]);
      });

      await reportsService.getSummary(TENANT_A, {});
    });
  });
});
