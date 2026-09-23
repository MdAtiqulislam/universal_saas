import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingInvoiceRepository } from '../repositories/billing-invoice.repository';
import {
  CreateInvoiceDto,
  InvoiceQueryDto,
  ApplyPaymentDto,
} from '../dto/billing-invoice.dto';
import { BillingInvoiceStatus, BillingPaymentStatus } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceRepo: BillingInvoiceRepository,
    private readonly audit: AuditService,
    private readonly eventBus: EventBusService,
    private readonly logger: StructuredLoggingService,
  ) {}

  generateInvoiceNumber(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `INV-${timestamp}-${rand}`;
  }

  async createInvoice(
    organizationId: string,
    dto: CreateInvoiceDto,
    actorUserId?: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    if (!dto.lineItems || dto.lineItems.length === 0) {
      throw new BadRequestException(
        'Invoice must contain at least one line item',
      );
    }

    // INV-446 & INV-447: Calculate subtotal deterministically from line items
    let subtotal = 0;
    const computedLineItems = dto.lineItems.map((item) => {
      const quantity = Math.max(1, item.quantity);
      const unitAmount = Math.max(0, item.unitAmount);
      const totalAmount = quantity * unitAmount;
      subtotal += totalAmount;
      return {
        description: item.description,
        itemType: item.itemType || 'SUBSCRIPTION',
        quantity,
        unitAmount,
        totalAmount,
      };
    });

    const taxAmount = Math.max(0, dto.taxAmount || 0);
    const discountAmount = Math.min(
      subtotal,
      Math.max(0, dto.discountAmount || 0),
    );

    // Calculate available credits to apply
    const availableCredit =
      await this.invoiceRepo.getAvailableCredit(organizationId);
    const preCreditTotal = subtotal + taxAmount - discountAmount;
    const creditApplied = Math.min(availableCredit, preCreditTotal);

    // Consume credits from ledger if applied
    if (creditApplied > 0) {
      await this.invoiceRepo.consumeCredit(organizationId, creditApplied);
    }

    // INV-447: total = subtotal + tax - discount - credit
    const totalAmount = Math.max(0, preCreditTotal - creditApplied);
    const amountDue = totalAmount;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // Net 30 default

    const invoice = await this.prisma.billingInvoice.create({
      data: {
        organizationId,
        subscriptionId: dto.subscriptionId,
        periodId: dto.periodId,
        invoiceNumber: this.generateInvoiceNumber(),
        status: BillingInvoiceStatus.DRAFT,
        currency: dto.currency || 'USD',
        subtotal,
        discountAmount,
        taxAmount,
        creditApplied,
        totalAmount,
        amountPaid: 0,
        amountDue,
        dueDate,
        lineItems: {
          create: computedLineItems,
        },
      },
      include: {
        lineItems: true,
        payments: true,
      },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.invoice.created',
        organizationId,
        actorUserId,
        resource: 'billing_invoice',
        resourceId: invoice.id,
        details: {
          invoiceNumber: invoice.invoiceNumber,
          totalAmount,
          subtotal,
          creditApplied,
        },
        eventName: 'billing.invoice.created',
        occurredAt: new Date(),
      });
    }

    return invoice;
  }

  async finalizeInvoice(
    invoiceId: string,
    organizationId: string,
    actorUserId?: string,
  ) {
    const invoice = await this.invoiceRepo.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    // INV-444: Invoice belongs to exactly one organization
    if (invoice.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot access invoice of another organization',
      );
    }

    // INV-445: Finalized invoices are immutable
    if (invoice.finalizedAt || invoice.status !== BillingInvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Invoice is already finalized and immutable',
      );
    }

    const nextStatus =
      invoice.totalAmount === 0
        ? BillingInvoiceStatus.PAID
        : BillingInvoiceStatus.OPEN;

    const finalized = await this.prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        finalizedAt: new Date(),
        paidAt: invoice.totalAmount === 0 ? new Date() : null,
      },
      include: {
        lineItems: true,
        payments: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'billing.invoice.finalized',
      occurredAt: new Date(),
      resourceId: invoice.id,
      organizationId,
      payload: {
        invoiceNumber: finalized.invoiceNumber,
        totalAmount: finalized.totalAmount,
        status: finalized.status,
      },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.invoice.finalized',
        organizationId,
        actorUserId,
        resource: 'billing_invoice',
        resourceId: invoice.id,
        details: {
          invoiceNumber: finalized.invoiceNumber,
          totalAmount: finalized.totalAmount,
        },
        eventName: 'billing.invoice.finalized',
        occurredAt: new Date(),
      });
    }

    return finalized;
  }

  async applyPayment(
    invoiceId: string,
    organizationId: string,
    dto: ApplyPaymentDto,
    actorUserId?: string,
  ) {
    const invoice = await this.invoiceRepo.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    // INV-444: Invoice belongs to exactly one organization
    if (invoice.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot access invoice of another organization',
      );
    }

    if (
      invoice.status === BillingInvoiceStatus.PAID ||
      invoice.status === BillingInvoiceStatus.VOID ||
      invoice.status === BillingInvoiceStatus.UNCOLLECTIBLE
    ) {
      throw new BadRequestException(
        `Cannot apply payment to invoice with status '${invoice.status}'`,
      );
    }

    // INV-448: Payment application cannot exceed the invoice amount due
    if (dto.amount > invoice.amountDue) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds invoice amount due (${invoice.amountDue})`,
      );
    }

    const updatedPaid = invoice.amountPaid + dto.amount;
    const updatedDue = invoice.totalAmount - updatedPaid;
    const isFullPayment = updatedDue === 0;

    const result = await this.prisma.$transaction(async (tx) => {
      // Record payment attempt
      const payment = await tx.billingPayment.create({
        data: {
          organizationId,
          invoiceId,
          amount: dto.amount,
          currency: invoice.currency,
          status: BillingPaymentStatus.SUCCEEDED,
          providerKey: dto.providerKey || 'sandbox',
          providerTransactionId:
            dto.providerTransactionId ||
            `txn_${crypto.randomBytes(8).toString('hex')}`,
          paidAt: new Date(),
        },
      });

      // Update invoice
      const updatedInvoice = await tx.billingInvoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: updatedPaid,
          amountDue: updatedDue,
          status: isFullPayment
            ? BillingInvoiceStatus.PAID
            : BillingInvoiceStatus.PARTIALLY_PAID,
          paidAt: isFullPayment ? new Date() : undefined,
        },
        include: {
          lineItems: true,
          payments: true,
        },
      });

      return { payment, invoice: updatedInvoice };
    });

    await this.eventBus.publish({
      eventName: 'billing.payment.succeeded',
      occurredAt: new Date(),
      resourceId: result.payment.id,
      organizationId,
      payload: {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: dto.amount,
        isFullPayment,
      },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.payment.applied',
        organizationId,
        actorUserId,
        resource: 'billing_payment',
        resourceId: result.payment.id,
        details: {
          invoiceId,
          amount: dto.amount,
          remainingDue: updatedDue,
        },
        eventName: 'billing.payment.applied',
        occurredAt: new Date(),
      });
    }

    return result;
  }

  async voidInvoice(
    invoiceId: string,
    organizationId: string,
    reason?: string,
    actorUserId?: string,
  ) {
    const invoice = await this.invoiceRepo.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    if (invoice.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot access invoice of another organization',
      );
    }

    if (invoice.status === BillingInvoiceStatus.PAID) {
      throw new BadRequestException('Cannot void a paid invoice');
    }

    const voided = await this.prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        status: BillingInvoiceStatus.VOID,
        voidedAt: new Date(),
        metadata: {
          ...((invoice.metadata as Record<string, unknown>) || {}),
          voidReason: reason || 'Voided by administrator',
        },
      },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.invoice.voided',
        organizationId,
        actorUserId,
        resource: 'billing_invoice',
        resourceId: invoice.id,
        details: { invoiceNumber: invoice.invoiceNumber, reason },
        eventName: 'billing.invoice.voided',
        occurredAt: new Date(),
      });
    }

    return voided;
  }

  async getInvoice(invoiceId: string, organizationId: string) {
    const invoice = await this.invoiceRepo.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    if (invoice.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot access invoice of another organization',
      );
    }

    return invoice;
  }

  async listInvoices(organizationId: string, query: InvoiceQueryDto) {
    return this.invoiceRepo.listInvoices(
      organizationId,
      query.status,
      query.page || 1,
      query.limit || 20,
    );
  }

  async listPayments(organizationId: string, limit: number = 50) {
    return this.invoiceRepo.listPayments(organizationId, limit);
  }
}
