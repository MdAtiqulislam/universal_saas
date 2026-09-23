import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Customer360QueryDto } from '../dto/customer-360-query.dto';
import { OpportunityStatus, Prisma } from '@prisma/client';

@Injectable()
export class CrmCustomer360Service {
  private readonly logger = new Logger(CrmCustomer360Service.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCustomer360(
    organizationId: string,
    customerId: string,
    query?: Customer360QueryDto,
  ) {
    const limit = query?.limit || 20;

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      include: {
        customerGroup: true,
        currency: true,
        contacts: { orderBy: { isPrimary: 'desc' } },
        addresses: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${customerId} not found in this organization.`,
      );
    }

    const [
      leads,
      opportunities,
      quotations,
      salesOrders,
      invoices,
      payments,
      shipments,
      returns,
      customerAssets,
      serviceTickets,
      serviceOrders,
      qualityIssues,
      activities,
    ] = await Promise.all([
      this.prisma.lead.findMany({
        where: { organizationId, convertedCustomerId: customerId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.opportunity.findMany({
        where: { organizationId, customerId },
        include: { lines: { include: { item: true } } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.quotation.findMany({
        where: { organizationId, customerId },
        include: { lines: { include: { item: true } } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesOrder.findMany({
        where: { organizationId, customerId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerInvoice.findMany({
        where: { organizationId, customerId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: { organizationId, customerId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shipment.findMany({
        where: { organizationId, customerId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.returnRequest.findMany({
        where: { organizationId, customerId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerAsset.findMany({
        where: { organizationId, customerId },
        include: {
          item: true,
          warranties: { include: { warrantyPolicy: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceTicket.findMany({
        where: { organizationId, customerId },
        include: { assignedTechnician: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceOrder.findMany({
        where: { organizationId, customerId },
        include: { assignedTechnician: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerQualityIssue.findMany({
        where: { organizationId, customerId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.crmActivity.findMany({
        where: { organizationId, customerId },
        include: { assignedEmployee: true, contact: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Financial KPIs calculation
    let lifetimeValue = new Prisma.Decimal(0);
    let outstandingBalance = new Prisma.Decimal(0);

    for (const inv of invoices) {
      lifetimeValue = lifetimeValue.add(inv.amountPaid);
      outstandingBalance = outstandingBalance.add(inv.amountDue);
    }

    let activePipelineValue = new Prisma.Decimal(0);
    let activeOpportunitiesCount = 0;

    for (const opp of opportunities) {
      if (opp.status === OpportunityStatus.OPEN) {
        activeOpportunitiesCount++;
        activePipelineValue = activePipelineValue.add(opp.estimatedValue);
      }
    }

    return {
      customer,
      kpis: {
        lifetimeValue: Number(lifetimeValue.toFixed(2)),
        outstandingBalance: Number(outstandingBalance.toFixed(2)),
        activeOpportunitiesCount,
        activePipelineValue: Number(activePipelineValue.toFixed(2)),
        totalSalesOrdersCount: salesOrders.length,
        totalInvoicesCount: invoices.length,
        totalServiceOrdersCount: serviceOrders.length,
        totalInstalledAssetsCount: customerAssets.length,
      },
      contacts: customer.contacts,
      leads,
      opportunities,
      quotations,
      salesOrders,
      invoices,
      payments,
      shipments,
      returns,
      customerAssets,
      serviceTickets,
      serviceOrders,
      qualityIssues,
      activities,
    };
  }
}
