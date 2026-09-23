import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FiscalPeriodsService } from './fiscal-periods.service';
import { PeriodCloseEngineService } from './period-close-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { FiscalPeriodStatus, PeriodCloseRunStatus } from '@prisma/client';

describe('FiscalPeriodsService', () => {
  let service: FiscalPeriodsService;
  let prismaMock: any;
  let eventBusMock: any;
  let closeEngineMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockPeriodId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      fiscalPeriod: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      periodCloseRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({ id: 'run-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      periodCloseCheck: {
        createMany: jest.fn().mockResolvedValue({ count: 11 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    closeEngineMock = {
      evaluateAllChecks: jest.fn().mockResolvedValue({
        runId: 'run-1',
        fiscalPeriodId: mockPeriodId,
        status: PeriodCloseRunStatus.PASSED,
        canClose: true,
        checks: [],
        summaryMessage: 'All checks passed',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiscalPeriodsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: PeriodCloseEngineService, useValue: closeEngineMock },
      ],
    }).compile();

    service = module.get<FiscalPeriodsService>(FiscalPeriodsService);
  });

  it('1. should create fiscal period', async () => {
    prismaMock.fiscalPeriod.findFirst
      .mockResolvedValueOnce(null) // name check
      .mockResolvedValueOnce(null); // overlap check

    prismaMock.fiscalPeriod.create.mockResolvedValue({
      id: mockPeriodId,
      organizationId: mockOrgId,
      name: 'FY2026-Q1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: FiscalPeriodStatus.OPEN,
    });

    const result = await service.create(
      mockOrgId,
      {
        name: 'FY2026-Q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      },
      mockUserId,
    );

    expect(result.id).toBe(mockPeriodId);
    expect(result.status).toBe(FiscalPeriodStatus.OPEN);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ACCOUNTING_PERIOD_CREATED',
      }),
    );
  });

  it('2. should reject period with startDate >= endDate', async () => {
    await expect(
      service.create(
        mockOrgId,
        {
          name: 'Invalid Period',
          startDate: '2026-03-31',
          endDate: '2026-01-01',
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject duplicate period name within tenant', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'existing-id',
      name: 'FY2026-Q1',
    });

    await expect(
      service.create(
        mockOrgId,
        {
          name: 'FY2026-Q1',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
        },
        mockUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('4. should reject overlapping date range within tenant', async () => {
    prismaMock.fiscalPeriod.findFirst
      .mockResolvedValueOnce(null) // name check passed
      .mockResolvedValueOnce({
        id: 'overlap-id',
        name: 'FY2026-Q1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
      }); // overlap check found

    await expect(
      service.create(
        mockOrgId,
        {
          name: 'FY2026-Q1-Overlap',
          startDate: '2026-02-01',
          endDate: '2026-04-30',
        },
        mockUserId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('5. should close fiscal period successfully after validation passes', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      status: FiscalPeriodStatus.OPEN,
      _count: { journalEntries: 10 },
    });

    prismaMock.fiscalPeriod.update.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      status: FiscalPeriodStatus.CLOSED,
      closedAt: new Date(),
    });

    const result = await service.close(mockOrgId, mockPeriodId, mockUserId);
    expect(result.status).toBe(FiscalPeriodStatus.CLOSED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ACCOUNTING_PERIOD_CLOSED',
      }),
    );
  });

  it('6. should reject closing already closed fiscal period', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      status: FiscalPeriodStatus.CLOSED,
      _count: { journalEntries: 10 },
    });

    await expect(
      service.close(mockOrgId, mockPeriodId, mockUserId),
    ).rejects.toThrow(BadRequestException);
  });

  it('7. should reopen closed fiscal period with audit reason', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      status: FiscalPeriodStatus.CLOSED,
      _count: { journalEntries: 10 },
    });

    prismaMock.fiscalPeriod.update.mockResolvedValue({
      id: mockPeriodId,
      name: 'FY2026-Q1',
      status: FiscalPeriodStatus.OPEN,
      reopenedAt: new Date(),
      reopenReason: 'Late tax audit adjustment',
    });

    const result = await service.reopen(
      mockOrgId,
      mockPeriodId,
      { reason: 'Late tax audit adjustment' },
      mockUserId,
    );

    expect(result.status).toBe(FiscalPeriodStatus.OPEN);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ACCOUNTING_PERIOD_REOPENED',
      }),
    );
  });

  it('8. should throw NotFoundException when period does not exist', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
