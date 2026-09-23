import { Test, TestingModule } from '@nestjs/testing';
import { PayrollReportsService } from './payroll-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PayrollPeriodStatus, PayrollRunStatus } from '@prisma/client';

describe('PayrollReportsService', () => {
  let service: PayrollReportsService;
  let prisma: {
    payrollPeriod: { findFirst: jest.Mock };
    payrollEmployee: { findMany: jest.Mock };
    employee: { findFirst: jest.Mock };
  };

  const orgId = 'org-101';
  const periodId = 'period-101';

  beforeEach(async () => {
    prisma = {
      payrollPeriod: { findFirst: jest.fn() },
      payrollEmployee: { findMany: jest.fn() },
      employee: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollReportsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PayrollReportsService>(PayrollReportsService);
  });

  it('should generate summary report correctly', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      name: 'January 2026 Payroll',
      status: PayrollPeriodStatus.POSTED,
      payrollRuns: [
        {
          runNumber: 'PRUN-000001',
          status: PayrollRunStatus.POSTED,
          employeeCount: 5,
          grossPay: new Prisma.Decimal(25000),
          totalTax: new Prisma.Decimal(2500),
          totalDeductions: new Prisma.Decimal(1250),
          netPay: new Prisma.Decimal(21250),
          employerCost: new Prisma.Decimal(27500),
        },
      ],
    });

    const res = await service.getSummary(orgId, periodId);

    expect(res.hasCalculatedRun).toBe(true);
    expect(res.summary?.grossPay).toBe('25000.0000');
    expect(res.summary?.netPay).toBe('21250.0000');
    expect(res.summary?.employerContributions).toBe('2500.0000');
  });

  it('should aggregate department breakdown report', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue({
      id: periodId,
      organizationId: orgId,
      periodNumber: 'PR-000001',
      name: 'January 2026 Payroll',
      payrollRuns: [
        {
          runNumber: 'PRUN-000001',
          payrollEmployees: [
            {
              employeeId: 'emp-1',
              employee: {
                employeeNumber: 'EMP-001',
                displayName: 'Alice',
                department: { name: 'Engineering' },
                jobPosition: { title: 'Engineer' },
              },
              baseSalary: new Prisma.Decimal(5000),
              allowances: new Prisma.Decimal(0),
              overtime: new Prisma.Decimal(0),
              grossPay: new Prisma.Decimal(5000),
              employeeTax: new Prisma.Decimal(300),
              employeeDeductions: new Prisma.Decimal(250),
              netPay: new Prisma.Decimal(4450),
              employerContributions: new Prisma.Decimal(500),
              totalEmployerCost: new Prisma.Decimal(5500),
              paymentStatus: 'PAID',
            },
            {
              employeeId: 'emp-2',
              employee: {
                employeeNumber: 'EMP-002',
                displayName: 'Bob',
                department: { name: 'Engineering' },
                jobPosition: { title: 'Engineer' },
              },
              baseSalary: new Prisma.Decimal(6000),
              allowances: new Prisma.Decimal(0),
              overtime: new Prisma.Decimal(0),
              grossPay: new Prisma.Decimal(6000),
              employeeTax: new Prisma.Decimal(500),
              employeeDeductions: new Prisma.Decimal(300),
              netPay: new Prisma.Decimal(5200),
              employerContributions: new Prisma.Decimal(600),
              totalEmployerCost: new Prisma.Decimal(6600),
              paymentStatus: 'PAID',
            },
          ],
        },
      ],
    });

    const res = await service.getDepartmentReport(orgId, periodId);

    expect(res.departments.length).toBe(1);
    expect(res.departments[0].department).toBe('Engineering');
    expect(res.departments[0].employeeCount).toBe(2);
    expect(res.departments[0].grossPay).toBe('11000.0000');
    expect(res.departments[0].netPay).toBe('9650.0000');
    expect(res.departments[0].employerCost).toBe('12100.0000');
  });
});
