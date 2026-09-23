import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  ServiceOrderStatus,
  CustomerInvoiceStatus,
  FiscalPeriodStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ServiceBillingIntegrationService {
  private readonly logger = new Logger(ServiceBillingIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async invoiceServiceOrder(
    organizationId: string,
    serviceOrderId: string,
    userId: string,
  ) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
      include: {
        customer: true,
        customerAsset: true,
        partsRequirements: {
          where: { warrantyCovered: false },
          include: { item: true },
        },
        laborEntries: {
          where: { warrantyCovered: false },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${serviceOrderId} not found in this organization.`,
      );
    }

    if (
      order.status !== ServiceOrderStatus.COMPLETED &&
      order.status !== ServiceOrderStatus.HANDED_OVER &&
      order.status !== ServiceOrderStatus.CLOSED
    ) {
      throw new BadRequestException(
        `Cannot invoice service order in status: ${order.status}. Must be COMPLETED or HANDED_OVER.`,
      );
    }

    if (order.customerInvoiceId) {
      const existingInv = await this.prisma.customerInvoice.findFirst({
        where: { id: order.customerInvoiceId, organizationId },
      });
      if (existingInv) {
        throw new ConflictException(
          `Service order ${order.serviceOrderNumber} is already invoiced (Invoice: ${existingInv.invoiceNumber}).`,
        );
      }
    }

    if (order.customerCharge.lte(0)) {
      throw new BadRequestException(
        'Service order has no billable customer charges to invoice (all covered under warranty or 0 charge).',
      );
    }

    // Default currency
    const defaultCurrency = await this.prisma.currency.findFirst({
      where: { code: 'USD', isActive: true },
    });
    const currencyId =
      order.customer.currencyId ||
      defaultCurrency?.id ||
      (await this.prisma.currency.findFirst({ where: { isActive: true } }))?.id;

    if (!currencyId) {
      throw new BadRequestException(
        'No currency found to generate customer invoice.',
      );
    }

    // Default fallback item
    const fallbackItemId =
      order.customerAsset?.itemId ||
      order.partsRequirements[0]?.itemId ||
      (await this.prisma.item.findFirst({ where: { organizationId } }))?.id;

    if (!fallbackItemId) {
      throw new BadRequestException(
        'No catalog item found to attach invoice lines.',
      );
    }

    // Generate invoiceNumber
    let invoiceNumber: string;
    try {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'CUSTOMER_INVOICE',
        userId,
      );
      invoiceNumber = seq.formatted;
    } catch {
      const count = await this.prisma.customerInvoice.count({
        where: { organizationId },
      });
      invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
    }

    const now = new Date();
    const dueDate = new Date(
      now.getTime() + (order.customer.paymentTermsDays || 30) * 86400000,
    );

    // Build Invoice Lines
    const invoiceLines: Array<{
      itemId: string;
      description: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    let invoiceSubtotal = new Prisma.Decimal(0);

    for (const part of order.partsRequirements) {
      const netQty = Prisma.Decimal.max(
        0,
        part.issuedQuantity.minus(part.returnedQuantity),
      );
      if (netQty.gt(0)) {
        const lineTotal = netQty.mul(part.unitPrice);
        invoiceLines.push({
          itemId: part.itemId,
          description: `Service Part: ${part.item.name}`,
          quantity: netQty,
          unitPrice: part.unitPrice,
          discountAmount: new Prisma.Decimal(0),
          taxRate: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          lineTotal,
        });
        invoiceSubtotal = invoiceSubtotal.plus(lineTotal);
      }
    }

    for (const labor of order.laborEntries) {
      if (labor.billableHours.gt(0)) {
        const lineTotal = labor.laborCharge;
        invoiceLines.push({
          itemId: fallbackItemId,
          description: `Service Labor: ${labor.description || 'Technician Labor'}`,
          quantity: labor.billableHours,
          unitPrice: labor.laborRate,
          discountAmount: new Prisma.Decimal(0),
          taxRate: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          lineTotal,
        });
        invoiceSubtotal = invoiceSubtotal.plus(lineTotal);
      }
    }

    if (invoiceLines.length === 0) {
      invoiceLines.push({
        itemId: fallbackItemId,
        description: `Service Charge for Order ${order.serviceOrderNumber}`,
        quantity: new Prisma.Decimal(1),
        unitPrice: order.customerCharge,
        discountAmount: new Prisma.Decimal(0),
        taxRate: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        lineTotal: order.customerCharge,
      });
      invoiceSubtotal = order.customerCharge;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.customerInvoice.create({
        data: {
          organizationId,
          invoiceNumber,
          customerId: order.customerId,
          currencyId,
          invoiceDate: now,
          dueDate,
          subtotal: invoiceSubtotal,
          discountAmount: new Prisma.Decimal(0),
          taxAmount: new Prisma.Decimal(0),
          grandTotal: invoiceSubtotal,
          amountDue: invoiceSubtotal,
          status: CustomerInvoiceStatus.ISSUED,
          notes: `Generated from Service Order ${order.serviceOrderNumber}`,
          createdByUserId: userId,
          issuedByUserId: userId,
          issuedAt: now,
          lines: {
            create: invoiceLines.map((l) => ({
              organizationId,
              itemId: l.itemId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount,
              taxRate: l.taxRate,
              taxAmount: l.taxAmount,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: {
          customer: true,
          lines: true,
        },
      });

      await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          customerInvoiceId: invoice.id,
        },
      });

      return invoice;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_ORDER_INVOICED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'invoice_service_order',
      resource: 'service_order',
      resourceId: order.id,
      details: {
        serviceOrderNumber: order.serviceOrderNumber,
        invoiceNumber: result.invoiceNumber,
        grandTotal: result.grandTotal.toString(),
      },
    });

    return result;
  }

  async postWarrantyExpenseJournal(
    organizationId: string,
    serviceOrderId: string,
    userId: string,
  ) {
    const order = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, organizationId },
      include: {
        partsRequirements: { where: { warrantyCovered: true } },
        laborEntries: { where: { warrantyCovered: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Service order with ID ${serviceOrderId} not found in this organization.`,
      );
    }

    if (order.warrantyCost.lte(0)) {
      return null;
    }

    // Check fiscal period open status
    const now = new Date();
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (period && period.status !== FiscalPeriodStatus.OPEN) {
      throw new BadRequestException(
        `Cannot post warranty expense journal: Fiscal period ${period.name} is ${period.status}.`,
      );
    }

    await this.eventBus.publish({
      eventName: 'WARRANTY_SERVICE_COMPLETED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'warranty_service_completed',
      resource: 'service_order',
      resourceId: order.id,
      details: {
        serviceOrderNumber: order.serviceOrderNumber,
        warrantyCost: order.warrantyCost.toString(),
      },
    });

    return {
      serviceOrderId: order.id,
      warrantyCost: order.warrantyCost,
      status: 'WARRANTY_EXPENSE_RECORDED',
    };
  }
}
