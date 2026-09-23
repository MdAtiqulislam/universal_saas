import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { PayrollConfigService } from './payroll-config.service';
import { CompensationService } from './compensation.service';
import {
  Prisma,
  PayrollPeriodStatus,
  PayrollRunStatus,
  EmploymentStatus,
  PayrollInputType,
} from '@prisma/client';

@Injectable()
export class PayrollCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly configService: PayrollConfigService,
    private readonly compensationService: CompensationService,
  ) {}

  async calculate(organizationId: string, periodId: string, userId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: { payrollInputs: true },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${periodId} not found.`);
    }

    if (
      period.status !== PayrollPeriodStatus.DRAFT &&
      period.status !== PayrollPeriodStatus.OPEN &&
      period.status !== PayrollPeriodStatus.CALCULATING &&
      period.status !== PayrollPeriodStatus.CALCULATED
    ) {
      throw new BadRequestException(
        `Cannot calculate payroll for period in status ${period.status}. Only DRAFT, OPEN, or CALCULATED periods can be calculated.`,
      );
    }

    const config = await this.configService.getOrCreate(organizationId);

    // 1. Fetch eligible active employees
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        employmentStatus: {
          in: [EmploymentStatus.ACTIVE, EmploymentStatus.ON_LEAVE],
        },
        hireDate: { lte: period.endDate },
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: period.startDate } },
        ],
        deletedAt: null,
      },
    });

    if (employees.length === 0) {
      throw new BadRequestException(
        'No eligible employees found for this payroll period.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Clean up previous runs for this period if re-calculating in DRAFT/CALCULATED
      await tx.payrollRun.deleteMany({
        where: {
          payrollPeriodId: period.id,
          organizationId,
          status: PayrollRunStatus.DRAFT,
        },
      });

      let totalGrossPay = new Prisma.Decimal(0);
      let totalDeductions = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);
      let totalNetPay = new Prisma.Decimal(0);
      let totalEmployerCost = new Prisma.Decimal(0);

      const employeeCalculations: Array<{
        employeeId: string;
        baseSalary: Prisma.Decimal;
        allowances: Prisma.Decimal;
        overtime: Prisma.Decimal;
        grossPay: Prisma.Decimal;
        taxableIncome: Prisma.Decimal;
        employeeTax: Prisma.Decimal;
        employeeDeductions: Prisma.Decimal;
        employerContributions: Prisma.Decimal;
        netPay: Prisma.Decimal;
        totalEmployerCost: Prisma.Decimal;
      }> = [];

      for (const emp of employees) {
        // Resolve effective compensation
        const comp = await this.compensationService.findEffective(
          organizationId,
          emp.id,
          period.endDate,
        );

        const baseSalary = comp ? comp.baseSalary : new Prisma.Decimal(0);
        const housing = comp ? comp.housingAllowance : new Prisma.Decimal(0);
        const transport = comp
          ? comp.transportAllowance
          : new Prisma.Decimal(0);
        const medical = comp ? comp.medicalAllowance : new Prisma.Decimal(0);
        const otherAllowance = comp
          ? comp.otherAllowance
          : new Prisma.Decimal(0);
        const overtimeRate = comp ? comp.overtimeRate : new Prisma.Decimal(0);

        const totalAllowances = housing
          .add(transport)
          .add(medical)
          .add(otherAllowance);

        // Aggregate employee inputs for this period
        const inputs = period.payrollInputs.filter(
          (i) => i.employeeId === emp.id,
        );

        let overtimeAmount = new Prisma.Decimal(0);
        let bonusAmount = new Prisma.Decimal(0);
        let commissionAmount = new Prisma.Decimal(0);
        let unpaidLeaveDeduction = new Prisma.Decimal(0);
        let otherDeductions = new Prisma.Decimal(0);

        for (const input of inputs) {
          if (input.inputType === PayrollInputType.OVERTIME) {
            if (input.amount.gt(0)) {
              overtimeAmount = overtimeAmount.add(input.amount);
            } else if (input.quantity.gt(0) && overtimeRate.gt(0)) {
              overtimeAmount = overtimeAmount.add(
                input.quantity.mul(overtimeRate),
              );
            }
          } else if (input.inputType === PayrollInputType.BONUS) {
            bonusAmount = bonusAmount.add(input.amount);
          } else if (input.inputType === PayrollInputType.COMMISSION) {
            commissionAmount = commissionAmount.add(input.amount);
          } else if (input.inputType === PayrollInputType.UNPAID_LEAVE) {
            unpaidLeaveDeduction = unpaidLeaveDeduction.add(input.amount);
          } else if (input.inputType === PayrollInputType.OTHER_DEDUCTION) {
            otherDeductions = otherDeductions.add(input.amount);
          }
        }

        // Gross Pay = Base Salary + Allowances + Overtime + Bonuses + Commissions - Unpaid Leave
        const grossPay = baseSalary
          .add(totalAllowances)
          .add(overtimeAmount)
          .add(bonusAmount)
          .add(commissionAmount)
          .sub(unpaidLeaveDeduction);

        const safeGross = grossPay.gt(0) ? grossPay : new Prisma.Decimal(0);

        // Tax Calculation Abstraction
        const taxableIncome = safeGross;
        let employeeTax = new Prisma.Decimal(0);

        if (config.taxEnabled && taxableIncome.gt(0)) {
          employeeTax = this.calculateTax(taxableIncome);
        }

        // Employee Deductions (Pension 5% + custom deductions)
        const pensionRate = new Prisma.Decimal('0.05');
        const employeePension = baseSalary.mul(pensionRate);
        const empDeductions = employeePension.add(otherDeductions);

        // Employer Contributions (Pension 10%)
        const employerPensionRate = new Prisma.Decimal('0.10');
        const employerPension = baseSalary.mul(employerPensionRate);

        // Net Pay = Gross Pay - Employee Tax - Employee Deductions
        let netPay = safeGross.sub(employeeTax).sub(empDeductions);
        if (netPay.lt(0)) {
          netPay = new Prisma.Decimal(0);
        }

        // Total Employer Cost = Gross Pay + Employer Contributions
        const employerCost = safeGross.add(employerPension);

        totalGrossPay = totalGrossPay.add(safeGross);
        totalDeductions = totalDeductions.add(empDeductions);
        totalTax = totalTax.add(employeeTax);
        totalNetPay = totalNetPay.add(netPay);
        totalEmployerCost = totalEmployerCost.add(employerCost);

        employeeCalculations.push({
          employeeId: emp.id,
          baseSalary,
          allowances: totalAllowances,
          overtime: overtimeAmount,
          grossPay: safeGross,
          taxableIncome,
          employeeTax,
          employeeDeductions: empDeductions,
          employerContributions: employerPension,
          netPay,
          totalEmployerCost: employerCost,
        });
      }

      const runCount = await tx.payrollRun.count({ where: { organizationId } });
      const runNumber = `PRUN-${String(runCount + 1).padStart(6, '0')}`;

      const run = await tx.payrollRun.create({
        data: {
          organizationId,
          payrollPeriodId: period.id,
          runNumber,
          status: PayrollRunStatus.CALCULATED,
          employeeCount: employeeCalculations.length,
          grossPay: totalGrossPay,
          totalDeductions: totalDeductions,
          totalTax: totalTax,
          netPay: totalNetPay,
          employerCost: totalEmployerCost,
          createdByUserId: userId,
          processedAt: new Date(),
          payrollEmployees: {
            create: employeeCalculations.map((calc) => ({
              organizationId,
              employeeId: calc.employeeId,
              baseSalary: calc.baseSalary,
              allowances: calc.allowances,
              overtime: calc.overtime,
              grossPay: calc.grossPay,
              taxableIncome: calc.taxableIncome,
              employeeTax: calc.employeeTax,
              employeeDeductions: calc.employeeDeductions,
              employerContributions: calc.employerContributions,
              netPay: calc.netPay,
              totalEmployerCost: calc.totalEmployerCost,
            })),
          },
        },
        include: {
          payrollEmployees: {
            include: {
              employee: {
                select: { id: true, employeeNumber: true, displayName: true },
              },
            },
          },
        },
      });

      await tx.payrollPeriod.update({
        where: { id: period.id },
        data: {
          status: PayrollPeriodStatus.CALCULATED,
          processedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'PAYROLL_CALCULATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'payroll.calculated',
        resource: 'payroll_run',
        resourceId: run.id,
        details: {
          runNumber: run.runNumber,
          periodNumber: period.periodNumber,
          employeeCount: run.employeeCount,
        },
      });

      return run;
    });
  }

  async approve(organizationId: string, periodId: string, userId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: {
        payrollRuns: {
          where: { status: PayrollRunStatus.CALCULATED },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${periodId} not found.`);
    }

    if (period.status !== PayrollPeriodStatus.CALCULATED) {
      throw new BadRequestException(
        `Cannot approve payroll period in status ${period.status}. Period must be in CALCULATED status.`,
      );
    }

    if (!period.payrollRuns || period.payrollRuns.length === 0) {
      throw new BadRequestException(
        'No calculated payroll run found for this period.',
      );
    }

    const run = period.payrollRuns[0];

    return this.prisma.$transaction(async (tx) => {
      const updatedRun = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.APPROVED,
          approvedByUserId: userId,
        },
      });

      await tx.payrollPeriod.update({
        where: { id: period.id },
        data: {
          status: PayrollPeriodStatus.APPROVED,
          approvedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'PAYROLL_APPROVED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'payroll.approved',
        resource: 'payroll_run',
        resourceId: updatedRun.id,
        details: {
          runNumber: updatedRun.runNumber,
          periodNumber: period.periodNumber,
        },
      });

      return updatedRun;
    });
  }

  /**
   * Pluggable payroll tax abstraction (standard progressive tax calculation).
   * 0 - 2,000 -> 0%
   * 2,000 - 5,000 -> 10%
   * 5,000+ -> 20%
   */
  private calculateTax(income: Prisma.Decimal): Prisma.Decimal {
    let tax = new Prisma.Decimal(0);
    const bracket1 = new Prisma.Decimal(2000);
    const bracket2 = new Prisma.Decimal(5000);

    if (income.gt(bracket2)) {
      const taxableOverBracket2 = income.sub(bracket2);
      const taxableBracket2 = bracket2.sub(bracket1);
      tax = tax
        .add(taxableBracket2.mul(new Prisma.Decimal('0.10')))
        .add(taxableOverBracket2.mul(new Prisma.Decimal('0.20')));
    } else if (income.gt(bracket1)) {
      const taxableBracket1 = income.sub(bracket1);
      tax = tax.add(taxableBracket1.mul(new Prisma.Decimal('0.10')));
    }

    return tax;
  }
}
