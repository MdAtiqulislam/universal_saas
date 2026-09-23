import { Test, TestingModule } from '@nestjs/testing';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { PayrollConfigService } from './payroll-config.service';
import { CompensationService } from './compensation.service';
import {
  Prisma,
  PayrollPeriodStatus,
  PayrollRunStatus,
  EmploymentStatus,
} from '@prisma/client';

describe('PayrollCalculationService', () => {
  let service: PayrollCalculationService;
  let prisma: {
    payrollPeriod: { findFirst: jest.Mock; update: jest.Mock };
    employee: { findMany: jest.Mock };
    payrollRun: {
      deleteMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };
  let configService: { getOrCreate: jest.Mock };
  let compensationService: { findEffective: jest.Mock };

  const orgId = 'org-101';
  const userId = 'user-101';
  const periodId = 'period-101';

  beforeEach(async () => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn(), update: jest.fn() },
      employee: { findMany: jest.fn() },
      payrollRun: {
        deleteMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      getOrCreate: jest.fn().mockResolvedValue({
        organizationId: orgId,
        taxEnabled: true,
        overtimeEnabled: true,
      }),
    };

    compensationService = {
      findEffective: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollCalculationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: PayrollConfigService, useValue: configService },
        { provide: CompensationService, useValue: compensationService },
      ],
    }).compile();

    service = module.get<PayrollCalculationService>(PayrollCalculationService);
  });

  describe('calculate', () => {
    it('should calculate gross pay, tax, deductions, and net pay correctly with Decimal precision', async () => {
      const period = {
        id: periodId,
        organizationId: orgId,
        periodNumber: 'PR-000001',
        name: 'January 2026 Payroll',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        paymentDate: new Date('2026-01-31'),
        status: PayrollPeriodStatus.DRAFT,
        payrollInputs: [
          {
            employeeId: 'emp-1',
            inputType: 'BONUS',
            amount: new Prisma.Decimal(500),
            quantity: new Prisma.Decimal(0),
          },
        ],
      };

      prisma.payrollPeriod.findFirst.mockResolvedValue(period);
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-1',
          organizationId: orgId,
          employeeNumber: 'EMP-00001',
          employmentStatus: EmploymentStatus.ACTIVE,
          hireDate: new Date('2025-01-01'),
          terminationDate: null,
        },
      ]);

      // Base salary 4,000, Housing 1,000, Transport 500
      // Total allowances = 1,500
      // Gross = 4,000 + 1,500 + 500 (bonus) = 6,000
      // Progressive Tax on 6,000:
      // Bracket 0-2000: 0
      // Bracket 2000-5000 (3000): 3000 * 0.10 = 300
      // Bracket 5000-6000 (1000): 1000 * 0.20 = 200
      // Total tax = 500
      // Pension (5% of 4000) = 200
      // Employer Pension (10% of 4000) = 400
      // Net Pay = 6000 - 500 - 200 = 5300
      // Employer Cost = 6000 + 400 = 6400
      compensationService.findEffective.mockResolvedValue({
        baseSalary: new Prisma.Decimal(4000),
        housingAllowance: new Prisma.Decimal(1000),
        transportAllowance: new Prisma.Decimal(500),
        medicalAllowance: new Prisma.Decimal(0),
        otherAllowance: new Prisma.Decimal(0),
        overtimeRate: new Prisma.Decimal(25),
      });

      prisma.payrollRun.count.mockResolvedValue(0);
      prisma.payrollRun.create.mockImplementation(({ data }) => ({
        id: 'run-1',
        ...data,
      }));

      const run = await service.calculate(orgId, periodId, userId);

      expect(run.employeeCount).toBe(1);
      expect(run.grossPay).toEqual(new Prisma.Decimal(6000));
      expect(run.totalTax).toEqual(new Prisma.Decimal(500));
      expect(run.totalDeductions).toEqual(new Prisma.Decimal(200));
      expect(run.netPay).toEqual(new Prisma.Decimal(5300));
      expect(run.employerCost).toEqual(new Prisma.Decimal(6400));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PAYROLL_CALCULATED' }),
      );
    });
  });

  describe('approve', () => {
    it('should transition calculated payroll to approved', async () => {
      prisma.payrollPeriod.findFirst.mockResolvedValue({
        id: periodId,
        organizationId: orgId,
        periodNumber: 'PR-000001',
        status: PayrollPeriodStatus.CALCULATED,
        payrollRuns: [
          {
            id: 'run-1',
            runNumber: 'PRUN-000001',
            status: PayrollRunStatus.CALCULATED,
          },
        ],
      });

      prisma.payrollRun.update.mockResolvedValue({
        id: 'run-1',
        runNumber: 'PRUN-000001',
        status: PayrollRunStatus.APPROVED,
      });

      const approved = await service.approve(orgId, periodId, userId);

      expect(approved.status).toBe(PayrollRunStatus.APPROVED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'PAYROLL_APPROVED' }),
      );
    });
  });
});
