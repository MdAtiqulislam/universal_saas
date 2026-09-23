import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, BillingInvoiceStatus } from '@prisma/client';

@Injectable()
export class BillingInvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoice(data: Prisma.BillingInvoiceCreateInput) {
    return this.prisma.billingInvoice.create({
      data,
      include: {
        lineItems: true,
        payments: true,
      },
    });
  }

  async findInvoiceById(id: string) {
    return this.prisma.billingInvoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        payments: true,
        subscription: true,
      },
    });
  }

  async findInvoiceByNumber(invoiceNumber: string) {
    return this.prisma.billingInvoice.findUnique({
      where: { invoiceNumber },
      include: {
        lineItems: true,
        payments: true,
      },
    });
  }

  async listInvoices(
    organizationId: string,
    status?: BillingInvoiceStatus,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: Prisma.BillingInvoiceWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.billingInvoice.findMany({
        where,
        include: {
          lineItems: true,
          payments: true,
        },
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billingInvoice.count({ where }),
    ]);

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateInvoice(id: string, data: Prisma.BillingInvoiceUpdateInput) {
    return this.prisma.billingInvoice.update({
      where: { id },
      data,
      include: {
        lineItems: true,
        payments: true,
      },
    });
  }

  async recordPayment(data: Prisma.BillingPaymentUncheckedCreateInput) {
    return this.prisma.billingPayment.create({ data });
  }

  async listPayments(organizationId: string, limit: number = 50) {
    return this.prisma.billingPayment.findMany({
      where: { organizationId },
      include: {
        invoice: {
          select: { invoiceNumber: true, totalAmount: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createCredit(data: Prisma.BillingCreditUncheckedCreateInput) {
    return this.prisma.billingCredit.create({ data });
  }

  async getAvailableCredit(organizationId: string): Promise<number> {
    const credits = await this.prisma.billingCredit.findMany({
      where: {
        organizationId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return credits.reduce(
      (sum, c) => sum + Math.max(0, c.amount - c.consumedAmount),
      0,
    );
  }

  async consumeCredit(organizationId: string, amountToConsume: number) {
    let remaining = amountToConsume;
    const credits = await this.prisma.billingCredit.findMany({
      where: {
        organizationId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const c of credits) {
      if (remaining <= 0) break;
      const avail = c.amount - c.consumedAmount;
      if (avail <= 0) continue;

      const take = Math.min(avail, remaining);
      await this.prisma.billingCredit.update({
        where: { id: c.id },
        data: { consumedAmount: { increment: take } },
      });
      remaining -= take;
    }
  }

  async findDiscountByCode(code: string) {
    return this.prisma.billingDiscount.findUnique({
      where: { code: code.toUpperCase() },
    });
  }

  async createDiscount(data: Prisma.BillingDiscountUncheckedCreateInput) {
    return this.prisma.billingDiscount.create({ data });
  }

  async listDiscounts() {
    return this.prisma.billingDiscount.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
