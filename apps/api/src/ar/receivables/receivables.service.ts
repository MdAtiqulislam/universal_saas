import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerInvoiceStatus, Prisma } from '@prisma/client';

export interface CustomerArBalance {
  customerId: string;
  customerCode: string;
  customerName: string;
  currencyId: string | null;
  currencyCode: string | null;
  currencySymbol: string | null;
  totalInvoiced: number;
  totalPaid: number;
  totalDue: number;
  overdueAmount: number;
  openInvoiceCount: number;
}

export interface CustomerAgingBucket {
  customerId: string;
  customerCode: string;
  customerName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90Plus: number;
  totalDue: number;
}

export interface ArAgingReport {
  generatedAt: Date;
  summary: {
    totalCurrent: number;
    totalDays1to30: number;
    totalDays31to60: number;
    totalDays61to90: number;
    totalDays90Plus: number;
    totalOutstanding: number;
  };
  customers: CustomerAgingBucket[];
}

@Injectable()
export class ReceivablesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate AR balance and overdue balance for a specific customer.
   */
  async getCustomerBalance(
    organizationId: string,
    customerId: string,
  ): Promise<CustomerArBalance> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      include: {
        currency: { select: { code: true, symbol: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${customerId} not found in this organization.`,
      );
    }

    const invoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        customerId,
        status: {
          in: [
            CustomerInvoiceStatus.ISSUED,
            CustomerInvoiceStatus.PARTIALLY_PAID,
            CustomerInvoiceStatus.PAID,
          ],
        },
      },
    });

    const now = new Date();
    let totalInvoiced = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalDue = new Prisma.Decimal(0);
    let overdueAmount = new Prisma.Decimal(0);
    let openInvoiceCount = 0;

    for (const inv of invoices) {
      totalInvoiced = totalInvoiced.add(new Prisma.Decimal(inv.grandTotal));
      totalPaid = totalPaid.add(new Prisma.Decimal(inv.amountPaid));

      const due = new Prisma.Decimal(inv.amountDue);
      if (due.greaterThan(0)) {
        totalDue = totalDue.add(due);
        openInvoiceCount++;

        if (new Date(inv.dueDate) < now) {
          overdueAmount = overdueAmount.add(due);
        }
      }
    }

    return {
      customerId: customer.id,
      customerCode: customer.code,
      customerName: customer.name,
      currencyId: customer.currencyId,
      currencyCode: customer.currency?.code ?? null,
      currencySymbol: customer.currency?.symbol ?? null,
      totalInvoiced: totalInvoiced.toNumber(),
      totalPaid: totalPaid.toNumber(),
      totalDue: totalDue.toNumber(),
      overdueAmount: overdueAmount.toNumber(),
      openInvoiceCount,
    };
  }

  /**
   * Generate AR aging report across all customers in the tenant organization.
   */
  async getAgingReport(organizationId: string): Promise<ArAgingReport> {
    const openInvoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        status: {
          in: [
            CustomerInvoiceStatus.ISSUED,
            CustomerInvoiceStatus.PARTIALLY_PAID,
          ],
        },
        amountDue: { gt: 0 },
      },
      include: {
        customer: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    const now = new Date();
    const customerMap = new Map<
      string,
      {
        customer: { id: string; code: string; name: string };
        current: Prisma.Decimal;
        days1to30: Prisma.Decimal;
        days31to60: Prisma.Decimal;
        days61to90: Prisma.Decimal;
        days90Plus: Prisma.Decimal;
        totalDue: Prisma.Decimal;
      }
    >();

    let summaryCurrent = new Prisma.Decimal(0);
    let summaryDays1to30 = new Prisma.Decimal(0);
    let summaryDays31to60 = new Prisma.Decimal(0);
    let summaryDays61to90 = new Prisma.Decimal(0);
    let summaryDays90Plus = new Prisma.Decimal(0);
    let summaryTotal = new Prisma.Decimal(0);

    for (const inv of openInvoices) {
      let entry = customerMap.get(inv.customerId);
      if (!entry) {
        entry = {
          customer: inv.customer,
          current: new Prisma.Decimal(0),
          days1to30: new Prisma.Decimal(0),
          days31to60: new Prisma.Decimal(0),
          days61to90: new Prisma.Decimal(0),
          days90Plus: new Prisma.Decimal(0),
          totalDue: new Prisma.Decimal(0),
        };
        customerMap.set(inv.customerId, entry);
      }

      const due = new Prisma.Decimal(inv.amountDue);
      entry.totalDue = entry.totalDue.add(due);
      summaryTotal = summaryTotal.add(due);

      const dueDate = new Date(inv.dueDate);
      const diffMs = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        entry.current = entry.current.add(due);
        summaryCurrent = summaryCurrent.add(due);
      } else if (diffDays <= 30) {
        entry.days1to30 = entry.days1to30.add(due);
        summaryDays1to30 = summaryDays1to30.add(due);
      } else if (diffDays <= 60) {
        entry.days31to60 = entry.days31to60.add(due);
        summaryDays31to60 = summaryDays31to60.add(due);
      } else if (diffDays <= 90) {
        entry.days61to90 = entry.days61to90.add(due);
        summaryDays61to90 = summaryDays61to90.add(due);
      } else {
        entry.days90Plus = entry.days90Plus.add(due);
        summaryDays90Plus = summaryDays90Plus.add(due);
      }
    }

    const customerBuckets: CustomerAgingBucket[] = Array.from(
      customerMap.values(),
    ).map((e) => ({
      customerId: e.customer.id,
      customerCode: e.customer.code,
      customerName: e.customer.name,
      current: e.current.toNumber(),
      days1to30: e.days1to30.toNumber(),
      days31to60: e.days31to60.toNumber(),
      days61to90: e.days61to90.toNumber(),
      days90Plus: e.days90Plus.toNumber(),
      totalDue: e.totalDue.toNumber(),
    }));

    return {
      generatedAt: now,
      summary: {
        totalCurrent: summaryCurrent.toNumber(),
        totalDays1to30: summaryDays1to30.toNumber(),
        totalDays31to60: summaryDays31to60.toNumber(),
        totalDays61to90: summaryDays61to90.toNumber(),
        totalDays90Plus: summaryDays90Plus.toNumber(),
        totalOutstanding: summaryTotal.toNumber(),
      },
      customers: customerBuckets,
    };
  }
}
