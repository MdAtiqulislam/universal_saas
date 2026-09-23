import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BudgetControlCheckDto } from './dto/budget-control-check.dto';
import {
  Prisma,
  BudgetStatus,
  BudgetControlPolicy,
  BudgetControlResult,
  JournalEntryStatus,
  AccountType,
} from '@prisma/client';

@Injectable()
export class BudgetControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async checkBudgetAvailability(
    organizationId: string,
    dto: BudgetControlCheckDto,
    userId?: string,
  ) {
    const targetDate = new Date(dto.date);
    const proposedAmount = new Prisma.Decimal(dto.amount);

    // 1. Locate Budget
    let budget;
    if (dto.budgetId) {
      budget = await this.prisma.budget.findFirst({
        where: { id: dto.budgetId, organizationId, deletedAt: null },
      });
      if (!budget) {
        throw new NotFoundException(`Budget ${dto.budgetId} not found.`);
      }
    } else {
      budget = await this.prisma.budget.findFirst({
        where: {
          organizationId,
          status: BudgetStatus.ACTIVE,
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
          deletedAt: null,
        },
      });
    }

    if (!budget) {
      return {
        hasBudget: false,
        result: BudgetControlResult.ALLOWED,
        message: 'No active budget found for the specified date.',
        policy: BudgetControlPolicy.CHECK_ONLY,
        proposedAmount: proposedAmount.toFixed(4),
        budgetAmount: '0.0000',
        actualAmount: '0.0000',
        remainingAmount: '0.0000',
        utilizationPercentage: 0,
      };
    }

    // 2. Locate Budget Line for Account and Date
    const line = await this.prisma.budgetLine.findFirst({
      where: {
        organizationId,
        budgetId: budget.id,
        accountId: dto.accountId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      include: { account: true },
    });

    if (!line) {
      return {
        hasBudget: false,
        result: BudgetControlResult.ALLOWED,
        message: `No budget line allocated for account ${dto.accountId} in budget ${budget.budgetNumber}.`,
        policy: budget.controlPolicy,
        proposedAmount: proposedAmount.toFixed(4),
        budgetAmount: '0.0000',
        actualAmount: '0.0000',
        remainingAmount: '0.0000',
        utilizationPercentage: 0,
      };
    }

    // 3. Compute current posted actuals
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        accountId: line.accountId,
        journalEntry: {
          status: JournalEntryStatus.POSTED,
          entryDate: {
            gte: line.startDate,
            lte: line.endDate,
          },
        },
      },
    });

    let currentActual = new Prisma.Decimal(0);
    for (const jl of journalLines) {
      if (
        line.account.type === AccountType.EXPENSE ||
        line.account.type === AccountType.ASSET
      ) {
        currentActual = currentActual.add(jl.debit).sub(jl.credit);
      } else {
        currentActual = currentActual.add(jl.credit).sub(jl.debit);
      }
    }

    const budgetAmount = line.amount;
    const availableRemaining = budgetAmount.sub(currentActual);
    const projectedActual = currentActual.add(proposedAmount);

    let projectedUtilization = new Prisma.Decimal(0);
    if (!budgetAmount.isZero()) {
      projectedUtilization = projectedActual.mul(100).div(budgetAmount);
    }

    let result: BudgetControlResult = BudgetControlResult.ALLOWED;
    let message = 'Transaction is within budget.';

    const isExceeded = projectedActual.greaterThan(budgetAmount);
    const isWarning =
      !isExceeded &&
      projectedUtilization.greaterThanOrEqualTo(budget.warnThresholdPercent);

    if (isExceeded) {
      if (budget.controlPolicy === BudgetControlPolicy.BLOCK) {
        result = BudgetControlResult.EXCEEDED;
        message = `Budget exceeded! Available remaining: ${availableRemaining.toFixed(4)}, proposed: ${proposedAmount.toFixed(4)}.`;
      } else if (budget.controlPolicy === BudgetControlPolicy.WARN) {
        result = BudgetControlResult.WARNING;
        message = `Budget warning: Proposed amount exceeds available remaining budget of ${availableRemaining.toFixed(4)}.`;
      } else {
        result = BudgetControlResult.ALLOWED;
        message = 'Policy is CHECK_ONLY; transaction allowed.';
      }

      await this.eventBus.publish({
        eventName: 'BUDGET_EXCEEDED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'budget.exceeded',
        resource: 'budget',
        resourceId: budget.id,
        details: {
          budgetId: budget.id,
          budgetNumber: budget.budgetNumber,
          accountId: line.accountId,
          budgetAmount: budgetAmount.toFixed(4),
          projectedActual: projectedActual.toFixed(4),
          policy: budget.controlPolicy,
        },
      });
    } else if (isWarning) {
      result = BudgetControlResult.WARNING;
      message = `Budget warning: Projected utilization (${projectedUtilization.toFixed(2)}%) reaches or exceeds threshold of ${budget.warnThresholdPercent.toFixed(2)}%.`;

      await this.eventBus.publish({
        eventName: 'BUDGET_THRESHOLD_REACHED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId,
        action: 'budget.threshold_reached',
        resource: 'budget',
        resourceId: budget.id,
        details: {
          budgetId: budget.id,
          budgetNumber: budget.budgetNumber,
          accountId: line.accountId,
          utilizationPercent: projectedUtilization.toFixed(2),
          thresholdPercent: budget.warnThresholdPercent.toFixed(2),
        },
      });
    }

    return {
      hasBudget: true,
      budgetId: budget.id,
      budgetNumber: budget.budgetNumber,
      account: {
        id: line.account.id,
        code: line.account.code,
        name: line.account.name,
      },
      period: line.period,
      policy: budget.controlPolicy,
      result,
      message,
      budgetAmount: budgetAmount.toFixed(4),
      currentActual: currentActual.toFixed(4),
      proposedAmount: proposedAmount.toFixed(4),
      projectedActual: projectedActual.toFixed(4),
      availableRemaining: availableRemaining.toFixed(4),
      projectedUtilizationPercentage: Number(projectedUtilization.toFixed(2)),
    };
  }
}
