import { Injectable } from '@nestjs/common';
import { BudgetVsActualService } from './budget-vs-actual.service';
import { EventBusService } from '../../events/event-bus.service';

export interface BudgetAlertItem {
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
  accountId: string;
  account: string;
  category: string;
  period: string;
  budgetAmount: string;
  actualAmount: string;
  utilizationPercent: number;
  variance: string;
  message: string;
}

@Injectable()
export class BudgetAlertsService {
  constructor(
    private readonly vsActualService: BudgetVsActualService,
    private readonly eventBus: EventBusService,
  ) {}

  async getAlerts(
    organizationId: string,
    budgetId: string,
    userId?: string,
  ): Promise<{
    budgetId: string;
    totalAlerts: number;
    alerts: BudgetAlertItem[];
  }> {
    const report = await this.vsActualService.getVsActual(
      organizationId,
      budgetId,
      {},
    );

    const alerts: BudgetAlertItem[] = [];

    for (const line of report.lines) {
      const util = line.utilizationPercent;

      if (util > 100) {
        alerts.push({
          type: 'EXCEEDED',
          accountId: line.accountId,
          account: `${line.accountCode} - ${line.accountName}`,
          category: line.category,
          period: line.period,
          budgetAmount: line.budgetAmount,
          actualAmount: line.actualAmount,
          utilizationPercent: util,
          variance: line.variance,
          message: `Budget exceeded by ${(util - 100).toFixed(2)}%! Actual: ${line.actualAmount}, Budget: ${line.budgetAmount}.`,
        });

        await this.eventBus.publish({
          eventName: 'BUDGET_VARIANCE_DETECTED',
          occurredAt: new Date(),
          organizationId,
          actorUserId: userId,
          action: 'budget.variance_detected',
          resource: 'budget',
          resourceId: budgetId,
          details: {
            accountId: line.accountId,
            variance: line.variance,
            utilizationPercent: util,
          },
        });
      } else if (util >= 90) {
        alerts.push({
          type: 'CRITICAL',
          accountId: line.accountId,
          account: `${line.accountCode} - ${line.accountName}`,
          category: line.category,
          period: line.period,
          budgetAmount: line.budgetAmount,
          actualAmount: line.actualAmount,
          utilizationPercent: util,
          variance: line.variance,
          message: `Critical budget threshold reached (${util}% utilized).`,
        });
      } else if (util >= 75) {
        alerts.push({
          type: 'WARNING',
          accountId: line.accountId,
          account: `${line.accountCode} - ${line.accountName}`,
          category: line.category,
          period: line.period,
          budgetAmount: line.budgetAmount,
          actualAmount: line.actualAmount,
          utilizationPercent: util,
          variance: line.variance,
          message: `Approaching budget limit (${util}% utilized).`,
        });
      }
    }

    return {
      budgetId,
      totalAlerts: alerts.length,
      alerts,
    };
  }
}
