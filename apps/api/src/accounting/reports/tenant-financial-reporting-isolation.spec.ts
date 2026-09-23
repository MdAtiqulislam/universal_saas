import { Test, TestingModule } from '@nestjs/testing';
import { FinancialReportsService } from './financial-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Financial Reporting Isolation', () => {
  let service: FinancialReportsService;
  let prismaMock: any;
  let eventBusMock: any;

  const orgA = '11111111-1111-1111-1111-111111111111';
  const userA = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      account: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      journalLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      paymentAccount: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<FinancialReportsService>(FinancialReportsService);
  });

  it('1. Org A cannot generate reports using Org B fiscal period', async () => {
    prismaMock.fiscalPeriod.findFirst.mockResolvedValue(null);

    await expect(
      service.getTrialBalance(orgA, { fiscalPeriodId: 'period-org-b' }, userA),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.fiscalPeriod.findFirst).toHaveBeenCalledWith({
      where: { id: 'period-org-b', organizationId: orgA },
    });
  });

  it('2. Org A cannot access Org B account balance drilldown', async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);

    await expect(
      service.getAccountBalance(orgA, 'acc-org-b', {}),
    ).rejects.toThrow(NotFoundException);

    expect(prismaMock.account.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'acc-org-b',
        organizationId: orgA,
      }),
    });
  });

  it('3. Org A trial balance enforces tenant isolation on accounts and journals', async () => {
    prismaMock.account.findMany.mockResolvedValue([]);
    prismaMock.journalLine.findMany.mockResolvedValue([]);

    await service.getTrialBalance(
      orgA,
      { startDate: '2026-01-01', endDate: '2026-12-31' },
      userA,
    );

    expect(prismaMock.account.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: orgA }),
      orderBy: [{ code: 'asc' }],
    });

    expect(prismaMock.journalLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: orgA }),
      }),
    );
  });
});
