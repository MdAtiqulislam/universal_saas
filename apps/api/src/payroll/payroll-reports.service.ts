import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PayrollReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: {
        payrollRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${periodId} not found.`);
    }

    const run = period.payrollRuns[0];
    if (!run) {
      return {
        periodNumber: period.periodNumber,
        periodName: period.name,
        status: period.status,
        hasCalculatedRun: false,
        summary: null,
      };
    }

    const employerContributions = run.employerCost.sub(run.grossPay);

    return {
      periodNumber: period.periodNumber,
      periodName: period.name,
      status: period.status,
      runNumber: run.runNumber,
      runStatus: run.status,
      employeeCount: run.employeeCount,
      hasCalculatedRun: true,
      summary: {
        grossPay: run.grossPay.toFixed(4),
        employeeTax: run.totalTax.toFixed(4),
        employeeDeductions: run.totalDeductions.toFixed(4),
        netPay: run.netPay.toFixed(4),
        employerContributions: employerContributions.toFixed(4),
        totalEmployerCost: run.employerCost.toFixed(4),
      },
    };
  }

  async getEmployeeReport(organizationId: string, periodId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: {
        payrollRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            payrollEmployees: {
              include: {
                employee: {
                  include: { department: true, jobPosition: true },
                },
              },
              orderBy: { employee: { lastName: 'asc' } },
            },
          },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${periodId} not found.`);
    }

    const run = period.payrollRuns[0];
    if (!run) {
      return { periodNumber: period.periodNumber, employees: [] };
    }

    const employees = run.payrollEmployees.map((pe) => ({
      employeeId: pe.employeeId,
      employeeNumber: pe.employee.employeeNumber,
      displayName: pe.employee.displayName,
      department: pe.employee.department?.name ?? 'Unassigned',
      jobPosition:
        pe.employee.jobPosition?.title ?? pe.employee.designation ?? 'Staff',
      baseSalary: pe.baseSalary.toFixed(4),
      allowances: pe.allowances.toFixed(4),
      overtime: pe.overtime.toFixed(4),
      grossPay: pe.grossPay.toFixed(4),
      employeeTax: pe.employeeTax.toFixed(4),
      employeeDeductions: pe.employeeDeductions.toFixed(4),
      netPay: pe.netPay.toFixed(4),
      employerContributions: pe.employerContributions.toFixed(4),
      totalEmployerCost: pe.totalEmployerCost.toFixed(4),
      paymentStatus: pe.paymentStatus,
    }));

    return {
      periodNumber: period.periodNumber,
      periodName: period.name,
      runNumber: run.runNumber,
      employees,
    };
  }

  async getDepartmentReport(organizationId: string, periodId: string) {
    const report = await this.getEmployeeReport(organizationId, periodId);

    const deptMap = new Map<
      string,
      {
        department: string;
        employeeCount: number;
        grossPay: Prisma.Decimal;
        employeeTax: Prisma.Decimal;
        netPay: Prisma.Decimal;
        employerCost: Prisma.Decimal;
      }
    >();

    for (const emp of report.employees) {
      if (!deptMap.has(emp.department)) {
        deptMap.set(emp.department, {
          department: emp.department,
          employeeCount: 0,
          grossPay: new Prisma.Decimal(0),
          employeeTax: new Prisma.Decimal(0),
          netPay: new Prisma.Decimal(0),
          employerCost: new Prisma.Decimal(0),
        });
      }

      const d = deptMap.get(emp.department)!;
      d.employeeCount++;
      d.grossPay = d.grossPay.add(new Prisma.Decimal(emp.grossPay));
      d.employeeTax = d.employeeTax.add(new Prisma.Decimal(emp.employeeTax));
      d.netPay = d.netPay.add(new Prisma.Decimal(emp.netPay));
      d.employerCost = d.employerCost.add(
        new Prisma.Decimal(emp.totalEmployerCost),
      );
    }

    const departments = Array.from(deptMap.values()).map((d) => ({
      department: d.department,
      employeeCount: d.employeeCount,
      grossPay: d.grossPay.toFixed(4),
      employeeTax: d.employeeTax.toFixed(4),
      netPay: d.netPay.toFixed(4),
      employerCost: d.employerCost.toFixed(4),
    }));

    return {
      periodNumber: report.periodNumber,
      departments,
    };
  }

  async getLiabilitiesReport(organizationId: string, periodId: string) {
    const summaryData = await this.getSummary(organizationId, periodId);
    if (!summaryData.summary) {
      return { periodNumber: summaryData.periodNumber, liabilities: null };
    }

    return {
      periodNumber: summaryData.periodNumber,
      periodName: summaryData.periodName,
      liabilities: {
        salariesPayable: summaryData.summary.netPay,
        taxPayable: summaryData.summary.employeeTax,
        pensionAndOtherPayable: summaryData.summary.employeeDeductions,
        employerContributionsPayable: summaryData.summary.employerContributions,
      },
    };
  }

  async getHistory(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found.`);
    }

    const history = await this.prisma.payrollEmployee.findMany({
      where: { employeeId, organizationId },
      include: {
        payrollRun: {
          include: { payrollPeriod: true },
        },
      },
      orderBy: { payrollRun: { payrollPeriod: { startDate: 'desc' } } },
    });

    return {
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        displayName: employee.displayName,
      },
      payrollHistory: history.map((h) => ({
        periodNumber: h.payrollRun.payrollPeriod.periodNumber,
        periodName: h.payrollRun.payrollPeriod.name,
        startDate: h.payrollRun.payrollPeriod.startDate
          .toISOString()
          .slice(0, 10),
        endDate: h.payrollRun.payrollPeriod.endDate.toISOString().slice(0, 10),
        paymentDate: h.payrollRun.payrollPeriod.paymentDate
          .toISOString()
          .slice(0, 10),
        grossPay: h.grossPay.toFixed(4),
        employeeTax: h.employeeTax.toFixed(4),
        employeeDeductions: h.employeeDeductions.toFixed(4),
        netPay: h.netPay.toFixed(4),
        employerCost: h.totalEmployerCost.toFixed(4),
        paymentStatus: h.paymentStatus,
      })),
    };
  }
}
