import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PayrollConfigService } from './payroll-config.service';
import {
  Prisma,
  PayrollPeriodStatus,
  PayrollRunStatus,
  JournalEntryStatus,
  FiscalPeriodStatus,
  AccountType,
} from '@prisma/client';

@Injectable()
export class PayrollPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly configService: PayrollConfigService,
  ) {}

  async post(organizationId: string, periodId: string, userId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, organizationId },
      include: {
        payrollRuns: {
          where: { status: PayrollRunStatus.APPROVED },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { payrollEmployees: true },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Payroll period ${periodId} not found.`);
    }

    if (period.status !== PayrollPeriodStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot post payroll period in status ${period.status}. Period must be in APPROVED status.`,
      );
    }

    if (!period.payrollRuns || period.payrollRuns.length === 0) {
      throw new BadRequestException(
        'No approved payroll run found for this period.',
      );
    }

    const run = period.payrollRuns[0];

    // 1. Locate Fiscal Period
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: period.paymentDate },
        endDate: { gte: period.paymentDate },
        status: FiscalPeriodStatus.OPEN,
      },
    });

    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering payroll payment date ${period.paymentDate.toISOString().slice(0, 10)}.`,
      );
    }

    // 2. Fetch or resolve Payroll Accounts
    const config = await this.configService.getOrCreate(organizationId);

    // Resolve Expense, Payable, Tax Accounts
    let expenseAccountId = config.payrollExpenseAccountId;
    let payableAccountId = config.payrollPayableAccountId;
    let taxPayableAccountId = config.payrollTaxPayableAccountId;

    if (!expenseAccountId) {
      const defaultExpense = await this.prisma.account.findFirst({
        where: {
          organizationId,
          type: AccountType.EXPENSE,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!defaultExpense) {
        throw new BadRequestException(
          'No payroll expense GL account configured or found.',
        );
      }
      expenseAccountId = defaultExpense.id;
    }

    if (!payableAccountId) {
      const defaultPayable = await this.prisma.account.findFirst({
        where: {
          organizationId,
          type: AccountType.LIABILITY,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!defaultPayable) {
        throw new BadRequestException(
          'No payroll payable GL account configured or found.',
        );
      }
      payableAccountId = defaultPayable.id;
    }

    if (!taxPayableAccountId && run.totalTax.gt(0)) {
      const defaultTax = await this.prisma.account.findFirst({
        where: {
          organizationId,
          type: AccountType.LIABILITY,
          isActive: true,
          deletedAt: null,
        },
      });
      taxPayableAccountId = defaultTax ? defaultTax.id : payableAccountId;
    }

    // Generate Journal Number
    const journalSeq = await this.numberingService.nextNumber(
      organizationId,
      'JOURNAL',
      userId,
    );
    const journalNumber = journalSeq.formatted;

    // Build balanced double-entry lines:
    // Debit: Payroll Expense (Gross Pay + Employer Contributions)
    // Credit: Payroll Payable (Net Pay)
    // Credit: Tax Payable (Total Tax)
    // Credit: Deductions / Pension Payable (Total Deductions + Employer Contributions)
    const employerContributions = run.employerCost.sub(run.grossPay);
    const totalDebits = run.grossPay.add(employerContributions);

    let lineNum = 1;
    const journalLinesData: Prisma.JournalLineCreateWithoutJournalEntryInput[] =
      [];

    // Debit: Payroll Expense (Gross)
    if (run.grossPay.gt(0)) {
      journalLinesData.push({
        organization: { connect: { id: organizationId } },
        account: { connect: { id: expenseAccountId } },
        description: `Payroll Expense - ${period.name} (${period.periodNumber})`,
        debit: run.grossPay,
        credit: new Prisma.Decimal(0),
        lineNumber: lineNum++,
      });
    }

    // Debit: Employer Contributions Expense (if any)
    if (employerContributions.gt(0)) {
      journalLinesData.push({
        organization: { connect: { id: organizationId } },
        account: { connect: { id: expenseAccountId } },
        description: `Employer Contributions - ${period.name}`,
        debit: employerContributions,
        credit: new Prisma.Decimal(0),
        lineNumber: lineNum++,
      });
    }

    // Credit: Payroll Payable (Net Pay)
    if (run.netPay.gt(0)) {
      journalLinesData.push({
        organization: { connect: { id: organizationId } },
        account: { connect: { id: payableAccountId } },
        description: `Salaries Payable - ${period.name}`,
        debit: new Prisma.Decimal(0),
        credit: run.netPay,
        lineNumber: lineNum++,
      });
    }

    // Credit: Payroll Tax Payable (Employee Tax)
    if (run.totalTax.gt(0) && taxPayableAccountId) {
      journalLinesData.push({
        organization: { connect: { id: organizationId } },
        account: { connect: { id: taxPayableAccountId } },
        description: `Payroll Tax Withholding - ${period.name}`,
        debit: new Prisma.Decimal(0),
        credit: run.totalTax,
        lineNumber: lineNum++,
      });
    }

    // Credit: Deductions & Employer Contributions Payable
    const totalOtherCredits = run.totalDeductions.add(employerContributions);
    if (totalOtherCredits.gt(0)) {
      journalLinesData.push({
        organization: { connect: { id: organizationId } },
        account: { connect: { id: payableAccountId } },
        description: `Deductions & Contributions Payable - ${period.name}`,
        debit: new Prisma.Decimal(0),
        credit: totalOtherCredits,
        lineNumber: lineNum++,
      });
    }

    // Transactional posting
    return this.prisma.$transaction(async (tx) => {
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: period.paymentDate,
          description: `Payroll Run: ${run.runNumber} - ${period.name}`,
          status: JournalEntryStatus.POSTED,
          sourceType: 'PAYROLL',
          sourceId: run.id,
          createdByUserId: userId,
          postedByUserId: userId,
          postedAt: new Date(),
          lines: { create: journalLinesData },
        },
      });

      const updatedRun = await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.POSTED,
          journalEntryId: glEntry.id,
          postedAt: new Date(),
        },
      });

      const updatedPeriod = await tx.payrollPeriod.update({
        where: { id: period.id },
        data: {
          status: PayrollPeriodStatus.POSTED,
          postedAt: new Date(),
        },
      });

      await this.eventBus.publish({
        eventName: 'PAYROLL_POSTED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'payroll.posted',
        resource: 'payroll_run',
        resourceId: updatedRun.id,
        details: {
          runNumber: updatedRun.runNumber,
          periodNumber: updatedPeriod.periodNumber,
          journalEntryId: glEntry.id,
          journalNumber: glEntry.entryNumber,
          totalDebits: totalDebits.toFixed(4),
        },
      });

      return {
        run: updatedRun,
        period: updatedPeriod,
        journalEntry: glEntry,
      };
    });
  }
}
