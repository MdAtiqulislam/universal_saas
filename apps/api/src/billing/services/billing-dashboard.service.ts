import { Injectable } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { EntitlementsService } from './entitlements.service';
import { InvoicesService } from './invoices.service';
import { CreditsDiscountsService } from './credits-discounts.service';
import { BillingReportsService } from './billing-reports.service';
import { BillingInvoiceStatus } from '@prisma/client';

@Injectable()
export class BillingDashboardService {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly invoicesService: InvoicesService,
    private readonly creditsService: CreditsDiscountsService,
    private readonly reportsService: BillingReportsService,
  ) {}

  async getTenantDashboard(organizationId: string) {
    const [
      subscription,
      entitlements,
      invoicesResult,
      payments,
      availableCredit,
    ] = await Promise.all([
      this.subscriptionsService.getActiveSubscription(organizationId),
      this.entitlementsService.getEntitlementsSummary(organizationId),
      this.invoicesService.listInvoices(organizationId, { limit: 5 }),
      this.invoicesService.listPayments(organizationId, 5),
      this.creditsService.getAvailableCredit(organizationId),
    ]);

    // Calculate outstanding unpaid amount
    const outstandingInvoices = await this.invoicesService.listInvoices(
      organizationId,
      { status: BillingInvoiceStatus.OPEN, limit: 100 },
    );
    const totalOutstandingAmount = outstandingInvoices.invoices.reduce(
      (acc, inv) => acc + inv.amountDue,
      0,
    );

    return {
      organizationId,
      subscription,
      entitlements,
      recentInvoices: invoicesResult.invoices,
      recentPayments: payments,
      financials: {
        availableCredit,
        totalOutstandingAmount,
        currency: subscription?.price?.currency || 'USD',
      },
    };
  }

  async getAdminKpis() {
    const [mrr, arr, summary, reliability] = await Promise.all([
      this.reportsService.getMrrReport(),
      this.reportsService.getArrReport(),
      this.reportsService.getSubscriptionSummary(),
      this.reportsService.getPaymentReliabilityReport(),
    ]);

    return {
      mrr: mrr.totalMrr,
      arr: arr.totalArr,
      subscriptionCount: mrr.subscriptionCount,
      statusSummary: summary,
      paymentSuccessRate: reliability.successRatePercentage,
      totalVolumeCollected: reliability.totalVolumeCollected,
      currency: mrr.currency,
    };
  }
}
