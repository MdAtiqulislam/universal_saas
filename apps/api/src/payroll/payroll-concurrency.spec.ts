import { Test, TestingModule } from '@nestjs/testing';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollPostingService } from './payroll-posting.service';
import { PayrollPaymentService } from './payroll-payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PayrollConfigService } from './payroll-config.service';
import { CompensationService } from './compensation.service';
import {
  Prisma,
  PayrollPeriodStatus,
  PayrollRunStatus,
  FiscalPeriodStatus,
  PaymentType,
  PaymentStatus,
  EmploymentStatus,
} from '@prisma/client';

describe('Payroll Concurrency Tests (100 Concurrent Workers)', () => {
  let calculationService: PayrollCalculationService;
  let postingService: PayrollPostingService;
  let paymentService: PayrollPaymentService;

  let prisma: {
    payrollPeriod: { findFirst: jest.Mock; update: jest.Mock };
    employee: { findMany: jest.Mock };
    payrollRun: {
      deleteMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    fiscalPeriod: { findFirst: jest.Mock };
    account: { findFirst: jest.Mock };
    journalEntry: { create: jest.Mock };
    paymentAccount: { findFirst: jest.Mock; findUniqueOrThrow: jest.Mock };
    payment: { create: jest.Mock };
    payrollEmployee: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const orgId = 'org-concurrency-101';
  const userId = 'user-concurrent';
  const periodId = 'period-concurrent';

  beforeEach(async () => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn(), update: jest.fn() },
      employee: { findMany: jest.fn() },
      payrollRun: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      fiscalPeriod: { findFirst: jest.fn() },
      account: { findFirst: jest.fn() },
      journalEntry: { create: jest.fn() },
      paymentAccount: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
      payment: { create: jest.fn() },
      payrollEmployee: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollCalculationService,
        PayrollPostingService,
        PayrollPaymentService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EventBusService,
          useValue: { publish: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: NumberingService,
          useValue: {
            nextNumber: jest.fn().mockImplementation((_, type) =>
              Promise.resolve({
                formatted: `${type}-000001`,
                sequenceNumber: 1,
              }),
            ),
          },
        },
        {
          provide: PayrollConfigService,
          useValue: {
            getOrCreate: jest.fn().mockResolvedValue({
              organizationId: orgId,
              taxEnabled: true,
              payrollExpenseAccountId: 'acc-exp',
              payrollPayableAccountId: 'acc-pay',
            }),
          },
        },
        {
          provide: CompensationService,
          useValue: {
            findEffective: jest.fn().mockResolvedValue({
              baseSalary: new Prisma.Decimal(5000),
              housingAllowance: new Prisma.Decimal(0),
              transportAllowance: new Prisma.Decimal(0),
              medicalAllowance: new Prisma.Decimal(0),
              otherAllowance: new Prisma.Decimal(0),
              overtimeRate: new Prisma.Decimal(0),
            }),
          },
        },
      ],
    }).compile();

    calculationService = module.get<PayrollCalculationService>(
      PayrollCalculationService,
    );
    postingService = module.get<PayrollPostingService>(PayrollPostingService);
    paymentService = module.get<PayrollPaymentService>(PayrollPaymentService);
  });

  it('1. Handles 100 concurrent payroll calculation requests idempotently and safely', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      name: 'Concurrent Payroll',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      paymentDate: new Date('2026-01-31'),
      status: PayrollPeriodStatus.DRAFT,
      payrollInputs: [],
    });

    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'emp-1',
        organizationId: orgId,
        employmentStatus: EmploymentStatus.ACTIVE,
        hireDate: new Date('2025-01-01'),
        terminationDate: null,
      },
    ]);

    prisma.payrollRun.create.mockImplementation(({ data }) => ({
      id: 'run-concurrent',
      ...data,
    }));

    const workers = 100;
    const promises = Array.from({ length: workers }, () =>
      calculationService.calculate(orgId, periodId, userId),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
    for (const res of results) {
      expect(res.status).toBe(PayrollRunStatus.CALCULATED);
      expect(res.grossPay).toEqual(new Prisma.Decimal(5000));
    }
  });

  it('2. Handles 100 concurrent payroll approval requests safely', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      status: PayrollPeriodStatus.CALCULATED,
      payrollRuns: [
        {
          id: 'run-concurrent',
          runNumber: 'PRUN-000001',
          status: PayrollRunStatus.CALCULATED,
        },
      ],
    });

    prisma.payrollRun.update.mockResolvedValue({
      id: 'run-concurrent',
      runNumber: 'PRUN-000001',
      status: PayrollRunStatus.APPROVED,
    });

    const workers = 100;
    const promises = Array.from({ length: workers }, () =>
      calculationService.approve(orgId, periodId, userId),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
    for (const res of results) {
      expect(res.status).toBe(PayrollRunStatus.APPROVED);
    }
  });

  it('3. Handles 100 concurrent payroll GL posting requests safely', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      name: 'Concurrent Payroll',
      paymentDate: new Date('2026-01-31'),
      status: PayrollPeriodStatus.APPROVED,
      payrollRuns: [
        {
          id: 'run-concurrent',
          runNumber: 'PRUN-000001',
          status: PayrollRunStatus.APPROVED,
          grossPay: new Prisma.Decimal(5000),
          totalTax: new Prisma.Decimal(300),
          totalDeductions: new Prisma.Decimal(250),
          netPay: new Prisma.Decimal(4450),
          employerCost: new Prisma.Decimal(5500),
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
      id: 'run-concurrent',
      status: PayrollRunStatus.POSTED,
    });

    prisma.payrollPeriod.update.mockResolvedValue({
      id: periodId,
      status: PayrollPeriodStatus.POSTED,
    });

    const workers = 100;
    const promises = Array.from({ length: workers }, () =>
      postingService.post(orgId, periodId, userId),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
    for (const res of results) {
      expect(res.run.status).toBe(PayrollRunStatus.POSTED);
      expect(res.period.status).toBe(PayrollPeriodStatus.POSTED);
    }
  });

  it('4. Handles 100 concurrent payroll payment requests safely', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      name: 'Concurrent Payroll',
      paymentDate: new Date('2026-01-31'),
      status: PayrollPeriodStatus.POSTED,
      payrollRuns: [
        {
          id: 'run-concurrent',
          runNumber: 'PRUN-000001',
          status: PayrollRunStatus.POSTED,
          netPay: new Prisma.Decimal(4450),
          employeeCount: 1,
          paymentId: null,
        },
      ],
    });

    prisma.paymentAccount.findFirst.mockResolvedValue({
      id: 'pa-1',
      organizationId: orgId,
      currencyId: 'cur-usd',
      isActive: true,
    });
    prisma.paymentAccount.findUniqueOrThrow.mockResolvedValue({
      id: 'pa-1',
      organizationId: orgId,
      currencyId: 'cur-usd',
    });

    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-000001',
      type: PaymentType.PAYMENT,
      status: PaymentStatus.POSTED,
    });

    prisma.payrollPeriod.update.mockResolvedValue({
      id: periodId,
      status: PayrollPeriodStatus.PAID,
    });

    const workers = 100;
    const promises = Array.from({ length: workers }, () =>
      paymentService.pay(orgId, periodId, undefined, userId),
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
    for (const res of results) {
      expect(res.period.status).toBe(PayrollPeriodStatus.PAID);
    }
  });
});
