import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { DepartmentsService } from './departments.service';
import { JobPositionsService } from './job-positions.service';
import { CompensationService } from './compensation.service';
import { PayrollPeriodsService } from './payroll-periods.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollPostingService } from './payroll-posting.service';
import { PayrollPaymentService } from './payroll-payment.service';
import { PayrollReportsService } from './payroll-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PayrollConfigService } from './payroll-config.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Payroll & HR Isolation Security', () => {
  let employeesService: EmployeesService;
  let departmentsService: DepartmentsService;
  let jobPositionsService: JobPositionsService;
  let compensationService: CompensationService;
  let periodsService: PayrollPeriodsService;
  let calculationService: PayrollCalculationService;
  let postingService: PayrollPostingService;
  let paymentService: PayrollPaymentService;
  let reportsService: PayrollReportsService;

  let prisma: {
    employee: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    department: { findFirst: jest.Mock; findMany: jest.Mock };
    jobPosition: { findFirst: jest.Mock; findMany: jest.Mock };
    employeeCompensation: { findFirst: jest.Mock; findMany: jest.Mock };
    payrollPeriod: { findFirst: jest.Mock; findMany: jest.Mock };
    payrollEmployee: { findMany: jest.Mock };
  };

  const TENANT_A = 'tenant-aaa-111';
  const USER_A = 'user-a';

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      department: { findFirst: jest.fn(), findMany: jest.fn() },
      jobPosition: { findFirst: jest.fn(), findMany: jest.fn() },
      employeeCompensation: { findFirst: jest.fn(), findMany: jest.fn() },
      payrollPeriod: { findFirst: jest.fn(), findMany: jest.fn() },
      payrollEmployee: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        DepartmentsService,
        JobPositionsService,
        CompensationService,
        PayrollPeriodsService,
        PayrollCalculationService,
        PayrollPostingService,
        PayrollPaymentService,
        PayrollReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: PayrollConfigService, useValue: { getOrCreate: jest.fn() } },
      ],
    }).compile();

    employeesService = module.get<EmployeesService>(EmployeesService);
    departmentsService = module.get<DepartmentsService>(DepartmentsService);
    jobPositionsService = module.get<JobPositionsService>(JobPositionsService);
    compensationService = module.get<CompensationService>(CompensationService);
    periodsService = module.get<PayrollPeriodsService>(PayrollPeriodsService);
    calculationService = module.get<PayrollCalculationService>(
      PayrollCalculationService,
    );
    postingService = module.get<PayrollPostingService>(PayrollPostingService);
    paymentService = module.get<PayrollPaymentService>(PayrollPaymentService);
    reportsService = module.get<PayrollReportsService>(PayrollReportsService);
  });

  it('1. Tenant A cannot view Tenant B employee', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(employeesService.findOne(TENANT_A, 'emp-b-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: TENANT_A,
          id: 'emp-b-1',
        }),
      }),
    );
  });

  it('2. Tenant A cannot update Tenant B employee', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(
      employeesService.update(
        TENANT_A,
        'emp-b-1',
        { firstName: 'Hacked' },
        USER_A,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. Tenant A cannot delete Tenant B employee', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(
      employeesService.delete(TENANT_A, 'emp-b-1', USER_A),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. Tenant A cannot view Tenant B department', async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    await expect(
      departmentsService.findOne(TENANT_A, 'dept-b-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('5. Tenant A cannot view Tenant B job position', async () => {
    prisma.jobPosition.findFirst.mockResolvedValue(null);
    await expect(
      jobPositionsService.findOne(TENANT_A, 'pos-b-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('6. Tenant A cannot view Tenant B compensation history', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(
      compensationService.findByEmployee(TENANT_A, 'emp-b-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Tenant A cannot add compensation to Tenant B employee', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(
      compensationService.create(
        TENANT_A,
        {
          employeeId: 'emp-b-1',
          effectiveFrom: '2026-01-01',
          baseSalary: 10000,
        },
        USER_A,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('8. Tenant A cannot view Tenant B payroll period', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue(null);
    await expect(
      periodsService.findOne(TENANT_A, 'period-b-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Tenant A cannot calculate Tenant B payroll period', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue(null);
    await expect(
      calculationService.calculate(TENANT_A, 'period-b-1', USER_A),
    ).rejects.toThrow(NotFoundException);
  });

  it('10. Tenant A cannot approve Tenant B payroll period', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue(null);
    await expect(
      calculationService.approve(TENANT_A, 'period-b-1', USER_A),
    ).rejects.toThrow(NotFoundException);
  });

  it('11. Tenant A cannot post Tenant B payroll period', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue(null);
    await expect(
      postingService.post(TENANT_A, 'period-b-1', USER_A),
    ).rejects.toThrow(NotFoundException);
  });

  it('12. Tenant A cannot pay Tenant B payroll period', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue(null);
    await expect(
      paymentService.pay(TENANT_A, 'period-b-1', undefined, USER_A),
    ).rejects.toThrow(NotFoundException);
  });

  it('13. Tenant A cannot access Tenant B payroll summary report', async () => {
    prisma.payrollPeriod.findFirst.mockResolvedValue(null);
    await expect(
      reportsService.getSummary(TENANT_A, 'period-b-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
