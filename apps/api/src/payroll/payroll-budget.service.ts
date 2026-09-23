import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BudgetControlService } from '../accounting/budgets/budget-control.service';
import { PayrollConfigService } from './payroll-config.service';
import { PayrollBudgetCheckDto } from './dto/payroll-budget-check.dto';
import { BudgetControlResult, AccountType } from '@prisma/client';

@Injectable()
export class PayrollBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly budgetControlService: BudgetControlService,
    private readonly configService: PayrollConfigService,
  ) {}

  async checkBudgetAvailability(
    organizationId: string,
    dto: PayrollBudgetCheckDto,
    userId?: string,
  ) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: dto.payrollPeriodId, organizationId },
      include: {
        payrollRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!period) {
      throw new NotFoundException(
        `Payroll period ${dto.payrollPeriodId} not found.`,
      );
    }

    const config = await this.configService.getOrCreate(organizationId);

    // Resolve Expense Account
    let expenseAccountId = config.payrollExpenseAccountId;
    if (!expenseAccountId) {
      const defaultExpense = await this.prisma.account.findFirst({
        where: {
          organizationId,
          type: AccountType.EXPENSE,
          isActive: true,
          deletedAt: null,
        },
      });
      if (defaultExpense) {
        expenseAccountId = defaultExpense.id;
      }
    }

    let amount = dto.estimatedAmount ?? 0;
    if (!amount && period.payrollRuns.length > 0) {
      amount = period.payrollRuns[0].employerCost.toNumber();
    }

    const date = dto.date || period.paymentDate.toISOString().slice(0, 10);

    if (!expenseAccountId) {
      return {
        hasBudget: false,
        result: BudgetControlResult.ALLOWED,
        message: 'No payroll expense account configured.',
      };
    }

    const controlResult =
      await this.budgetControlService.checkBudgetAvailability(
        organizationId,
        {
          accountId: expenseAccountId,
          amount,
          date,
        },
        userId,
      );

    if (controlResult.result === BudgetControlResult.WARNING) {
      await this.eventBus.publish({
        eventName: 'PAYROLL_BUDGET_WARNING',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'payroll.budget_warning',
        resource: 'payroll_period',
        resourceId: period.id,
        details: {
          periodNumber: period.periodNumber,
          amount,
          availableRemaining: controlResult.availableRemaining,
        },
      });
    } else if (controlResult.result === BudgetControlResult.EXCEEDED) {
      await this.eventBus.publish({
        eventName: 'PAYROLL_BUDGET_EXCEEDED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'payroll.budget_exceeded',
        resource: 'payroll_period',
        resourceId: period.id,
        details: {
          periodNumber: period.periodNumber,
          amount,
          availableRemaining: controlResult.availableRemaining,
        },
      });
    }

    return {
      payrollPeriodId: period.id,
      periodNumber: period.periodNumber,
      ...controlResult,
    };
  }
}
