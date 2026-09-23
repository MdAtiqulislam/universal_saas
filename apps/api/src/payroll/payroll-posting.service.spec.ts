import { Test, TestingModule } from '@nestjs/testing';
import { PayrollPostingService } from './payroll-posting.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PayrollConfigService } from './payroll-config.service';
import {
  Prisma,
  PayrollPeriodStatus,
  PayrollRunStatus,
  FiscalPeriodStatus,
} from '@prisma/client';

describe('PayrollPostingService', () => {
  let service: PayrollPostingService;
  let prisma: {
    payrollPeriod: { findFirst: jest.Mock; update: jest.Mock };
    fiscalPeriod: { findFirst: jest.Mock };
    account: { findFirst: jest.Mock };
    payrollRun: { update: jest.Mock };
    journalEntry: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };
  let numberingService: { nextNumber: jest.Mock };
  let configService: { getOrCreate: jest.Mock };

  const orgId = 'org-101';
  const userId = 'user-101';
  const periodId = 'period-101';

  beforeEach(async () => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn(), update: jest.fn() },
      fiscalPeriod: { findFirst: jest.fn() },
      account: { findFirst: jest.fn() },
      payrollRun: { update: jest.fn() },
      journalEntry: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest
        .fn()
        .mockResolvedValue({ formatted: 'JE-000001', sequenceNumber: 1 }),
    };
    configService = {
      getOrCreate: jest.fn().mockResolvedValue({
        payrollExpenseAccountId: 'acc-exp-1',
        payrollPayableAccountId: 'acc-pay-1',
        payrollTaxPayableAccountId: 'acc-tax-1',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollPostingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: PayrollConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PayrollPostingService>(PayrollPostingService);
  });

  it('should post balanced journal entry for approved payroll run', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      name: 'January 2026 Payroll',
      paymentDate: new Date('2026-01-31'),
      status: PayrollPeriodStatus.APPROVED,
      payrollRuns: [
        {
          id: 'run-1',
          runNumber: 'PRUN-000001',
          status: PayrollRunStatus.APPROVED,
          grossPay: new Prisma.Decimal(6000),
          totalTax: new Prisma.Decimal(500),
          totalDeductions: new Prisma.Decimal(200),
          netPay: new Prisma.Decimal(5300),
          employerCost: new Prisma.Decimal(6400),
        },
      ],
    });

    prisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: 'fp-1',
      organizationId: orgId,
      status: FiscalPeriodStatus.OPEN,
    });

    prisma.journalEntry.create.mockResolvedValue({
      id: 'je-1',
      entryNumber: 'JE-000001',
    });

    prisma.payrollRun.update.mockResolvedValue({
      id: 'run-1',
      status: PayrollRunStatus.POSTED,
    });

    prisma.payrollPeriod.update.mockResolvedValue({
      id: periodId,
      status: PayrollPeriodStatus.POSTED,
    });

    const res = await service.post(orgId, periodId, userId);

    expect(res.run.status).toBe(PayrollRunStatus.POSTED);
    expect(prisma.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'PAYROLL',
          sourceId: 'run-1',
        }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'PAYROLL_POSTED' }),
    );
  });
});
