import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ApAccountMappingService } from '../../ap/account-mapping/ap-account-mapping.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AllocatePaymentDto } from './dto/allocate-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import {
  Payment,
  PaymentType,
  PaymentStatus,
  JournalEntryStatus,
  FiscalPeriodStatus,
  CustomerInvoiceStatus,
  SupplierInvoiceStatus,
  Prisma,
} from '@prisma/client';

export type PaymentWithDetails = Prisma.PaymentGetPayload<{
  include: {
    paymentAccount: {
      select: {
        id: true;
        code: true;
        name: true;
        type: true;
        accountingAccountId: true;
      };
    };
    currency: {
      select: { id: true; code: true; name: true; symbol: true };
    };
    customer: {
      select: { id: true; code: true; name: true };
    };
    supplier: {
      select: { id: true; code: true; name: true };
    };
    allocations: {
      include: {
        customerInvoice: {
          select: {
            id: true;
            invoiceNumber: true;
            grandTotal: true;
            amountDue: true;
          };
        };
        supplierInvoice: {
          select: {
            id: true;
            invoiceNumber: true;
            grandTotal: true;
            amountDue: true;
          };
        };
      };
    };
  };
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly accountMappingService: ApAccountMappingService,
  ) {}

  /**
   * Create a new draft payment or customer receipt.
   */
  async create(
    organizationId: string,
    dto: CreatePaymentDto,
    actorUserId: string,
  ): Promise<PaymentWithDetails> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Payment amount must be greater than 0.');
    }

    // 1. Verify payment account exists in organization and is active
    const paymentAccount = await this.prisma.paymentAccount.findFirst({
      where: { id: dto.paymentAccountId, organizationId, deletedAt: null },
    });
    if (!paymentAccount) {
      throw new NotFoundException(
        `Payment account with ID ${dto.paymentAccountId} not found in this organization.`,
      );
    }
    if (!paymentAccount.isActive) {
      throw new BadRequestException(
        `Payment account '${paymentAccount.code} - ${paymentAccount.name}' is inactive.`,
      );
    }

    // 2. Resolve currency
    const currencyId = dto.currencyId ?? paymentAccount.currencyId;
    const currency = await this.prisma.currency.findFirst({
      where: { id: currencyId, isActive: true },
    });
    if (!currency) {
      throw new NotFoundException(
        `Currency with ID ${currencyId} not found or inactive.`,
      );
    }

    // 3. Validate customer or supplier depending on type
    if (dto.type === PaymentType.RECEIPT) {
      if (dto.customerId) {
        const customer = await this.prisma.customer.findFirst({
          where: { id: dto.customerId, organizationId, deletedAt: null },
        });
        if (!customer) {
          throw new NotFoundException(
            `Customer with ID ${dto.customerId} not found in this organization.`,
          );
        }
      }
    } else if (dto.type === PaymentType.PAYMENT) {
      if (dto.supplierId) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { id: dto.supplierId, organizationId, deletedAt: null },
        });
        if (!supplier) {
          throw new NotFoundException(
            `Supplier with ID ${dto.supplierId} not found in this organization.`,
          );
        }
      }
    }

    // 4. Generate payment number
    let paymentNumber: string;
    const sequenceKey =
      dto.type === PaymentType.RECEIPT
        ? 'CUSTOMER_RECEIPT'
        : 'SUPPLIER_PAYMENT';
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        sequenceKey,
        actorUserId,
      );
      paymentNumber = generated.formatted;
    } catch {
      const prefix = dto.type === PaymentType.RECEIPT ? 'RC' : 'PY';
      const count = await this.prisma.payment.count({
        where: { organizationId, type: dto.type },
      });
      paymentNumber = `${prefix}-${String(count + 1).padStart(6, '0')}`;
    }

    // 5. Create payment
    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        paymentNumber,
        type: dto.type,
        paymentAccountId: dto.paymentAccountId,
        currencyId,
        customerId:
          dto.type === PaymentType.RECEIPT ? (dto.customerId ?? null) : null,
        supplierId:
          dto.type === PaymentType.PAYMENT ? (dto.supplierId ?? null) : null,
        paymentDate: new Date(dto.paymentDate),
        amount,
        allocatedAmount: new Prisma.Decimal(0),
        unallocatedAmount: amount,
        reference: dto.reference?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        status: PaymentStatus.DRAFT,
        createdByUserId: actorUserId,
      },
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        customer: {
          select: { id: true, code: true, name: true },
        },
        supplier: {
          select: { id: true, code: true, name: true },
        },
        allocations: {
          include: {
            customerInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                grandTotal: true,
                amountDue: true,
              },
            },
            supplierInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                grandTotal: true,
                amountDue: true,
              },
            },
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'PAYMENT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'payment.create',
      resource: 'payment',
      resourceId: payment.id,
      details: {
        paymentNumber: payment.paymentNumber,
        type: payment.type,
        amount: payment.amount.toString(),
      },
    });

    if (payment.type === PaymentType.RECEIPT) {
      await this.eventBus.publish({
        eventName: 'CUSTOMER_RECEIPT_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'customer_receipt.create',
        resource: 'payment',
        resourceId: payment.id,
        details: { paymentNumber: payment.paymentNumber },
      });
    } else {
      await this.eventBus.publish({
        eventName: 'SUPPLIER_PAYMENT_CREATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'supplier_payment.create',
        resource: 'payment',
        resourceId: payment.id,
        details: { paymentNumber: payment.paymentNumber },
      });
    }

    return payment;
  }

  /**
   * Post draft payment to General Ledger (DRAFT -> POSTED).
   */
  async post(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<PaymentWithDetails> {
    const payment = await this.findOne(organizationId, id);

    if (payment.status !== PaymentStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT payments can be posted. Current status: ${payment.status}`,
      );
    }

    // 1. Resolve open fiscal period for payment date
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: payment.paymentDate },
        endDate: { gte: payment.paymentDate },
      },
    });

    if (!fiscalPeriod) {
      throw new BadRequestException(
        `No OPEN fiscal period found covering payment date (${payment.paymentDate.toISOString().slice(0, 10)}).`,
      );
    }

    // 2. Resolve GL Accounts
    const paymentAccountId = payment.paymentAccount.accountingAccountId;

    let contraAccountId: string;
    let description: string;
    let journalLinesData: Array<{
      organizationId: string;
      accountId: string;
      description: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      lineNumber: number;
    }>;

    if (payment.type === PaymentType.RECEIPT) {
      // Customer Receipt: Debit Bank / Payment Account, Credit Accounts Receivable
      contraAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'ACCOUNTS_RECEIVABLE',
      );
      description = `Customer Receipt: ${payment.paymentNumber}${
        payment.customer ? ` (${payment.customer.name})` : ''
      }`;

      journalLinesData = [
        {
          organizationId,
          accountId: paymentAccountId,
          description: `${payment.paymentNumber} - Funds Received`,
          debit: payment.amount,
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
        },
        {
          organizationId,
          accountId: contraAccountId,
          description: `${payment.paymentNumber} - AR Settlement`,
          debit: new Prisma.Decimal(0),
          credit: payment.amount,
          lineNumber: 2,
        },
      ];
    } else {
      // Supplier Payment: Debit Accounts Payable, Credit Bank / Payment Account
      contraAccountId = await this.accountMappingService.resolveAccount(
        organizationId,
        'ACCOUNTS_PAYABLE',
      );
      description = `Supplier Payment: ${payment.paymentNumber}${
        payment.supplier ? ` (${payment.supplier.name})` : ''
      }`;

      journalLinesData = [
        {
          organizationId,
          accountId: contraAccountId,
          description: `${payment.paymentNumber} - AP Settlement`,
          debit: payment.amount,
          credit: new Prisma.Decimal(0),
          lineNumber: 1,
        },
        {
          organizationId,
          accountId: paymentAccountId,
          description: `${payment.paymentNumber} - Funds Disbursed`,
          debit: new Prisma.Decimal(0),
          credit: payment.amount,
          lineNumber: 2,
        },
      ];
    }

    // 3. Generate journal entry number
    let journalNumber: string;
    try {
      const generated = await this.numberingService.nextNumber(
        organizationId,
        'JOURNAL_ENTRY',
        actorUserId,
      );
      journalNumber = generated.formatted;
    } catch {
      const count = await this.prisma.journalEntry.count({
        where: { organizationId },
      });
      journalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
    }

    // 4. Create posted GL journal and update payment status in transaction
    const posted = await this.prisma.$transaction(async (tx) => {
      const glEntry = await tx.journalEntry.create({
        data: {
          organizationId,
          fiscalPeriodId: fiscalPeriod.id,
          entryNumber: journalNumber,
          entryDate: payment.paymentDate,
          description,
          status: JournalEntryStatus.POSTED,
          sourceType: 'PAYMENT',
          sourceId: payment.id,
          createdByUserId: actorUserId,
          postedByUserId: actorUserId,
          postedAt: new Date(),
        },
      });

      await tx.journalLine.createMany({
        data: journalLinesData.map((l) => ({
          ...l,
          journalEntryId: glEntry.id,
        })),
      });

      return tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: actorUserId,
          journalEntryId: glEntry.id,
        },
        include: {
          paymentAccount: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              accountingAccountId: true,
            },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          customer: {
            select: { id: true, code: true, name: true },
          },
          supplier: {
            select: { id: true, code: true, name: true },
          },
          allocations: {
            include: {
              customerInvoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  grandTotal: true,
                  amountDue: true,
                },
              },
              supplierInvoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  grandTotal: true,
                  amountDue: true,
                },
              },
            },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'PAYMENT_POSTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'payment.post',
      resource: 'payment',
      resourceId: id,
      details: {
        paymentNumber: posted.paymentNumber,
        amount: posted.amount.toString(),
        journalEntryId: posted.journalEntryId,
      },
    });

    return posted;
  }

  /**
   * Allocate posted payment against open customer or supplier invoices.
   */
  async allocate(
    organizationId: string,
    id: string,
    dto: AllocatePaymentDto,
    actorUserId: string,
  ): Promise<PaymentWithDetails> {
    if (!dto.allocations || dto.allocations.length === 0) {
      throw new BadRequestException(
        'At least one allocation must be provided.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch and lock payment
      const payment = await tx.payment.findFirst({
        where: { id, organizationId },
        include: {
          paymentAccount: true,
          currency: true,
          customer: true,
          supplier: true,
          allocations: true,
        },
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment with ID ${id} not found in this organization.`,
        );
      }

      if (
        payment.status !== PaymentStatus.POSTED &&
        payment.status !== PaymentStatus.PARTIALLY_ALLOCATED
      ) {
        throw new BadRequestException(
          `Payment must be in POSTED or PARTIALLY_ALLOCATED status to allocate. Current status: ${payment.status}`,
        );
      }

      let totalAllocation = new Prisma.Decimal(0);
      for (const item of dto.allocations) {
        const itemAmount = new Prisma.Decimal(item.amount);
        if (itemAmount.lessThanOrEqualTo(0)) {
          throw new BadRequestException(
            'Allocation amount must be greater than 0.',
          );
        }
        totalAllocation = totalAllocation.add(itemAmount);
      }

      if (totalAllocation.greaterThan(payment.unallocatedAmount)) {
        throw new BadRequestException(
          `Total allocation requested (${totalAllocation.toString()}) exceeds payment unallocated amount (${payment.unallocatedAmount.toString()}).`,
        );
      }

      // 2. Process each allocation
      for (const item of dto.allocations) {
        const allocAmount = new Prisma.Decimal(item.amount);

        // XOR target check
        if (
          (!item.customerInvoiceId && !item.supplierInvoiceId) ||
          (item.customerInvoiceId && item.supplierInvoiceId)
        ) {
          throw new BadRequestException(
            'Each allocation must specify either customerInvoiceId OR supplierInvoiceId, but not both.',
          );
        }

        if (item.customerInvoiceId) {
          if (payment.type !== PaymentType.RECEIPT) {
            throw new BadRequestException(
              'Customer invoices can only be allocated against RECEIPT payments.',
            );
          }

          const invoice = await tx.customerInvoice.findFirst({
            where: { id: item.customerInvoiceId, organizationId },
          });
          if (!invoice) {
            throw new NotFoundException(
              `Customer invoice with ID ${item.customerInvoiceId} not found in this organization.`,
            );
          }
          if (
            invoice.status !== CustomerInvoiceStatus.ISSUED &&
            invoice.status !== CustomerInvoiceStatus.PARTIALLY_PAID
          ) {
            throw new BadRequestException(
              `Customer invoice ${invoice.invoiceNumber} is not in an open status (Current: ${invoice.status}).`,
            );
          }
          if (invoice.currencyId !== payment.currencyId) {
            throw new BadRequestException(
              `Invoice currency does not match payment currency.`,
            );
          }
          if (payment.customerId && invoice.customerId !== payment.customerId) {
            throw new BadRequestException(
              `Invoice customer does not match payment customer.`,
            );
          }
          if (allocAmount.greaterThan(invoice.amountDue)) {
            throw new BadRequestException(
              `Allocation amount (${allocAmount.toString()}) exceeds invoice amount due (${invoice.amountDue.toString()}).`,
            );
          }

          // Create allocation
          await tx.paymentAllocation.create({
            data: {
              organizationId,
              paymentId: payment.id,
              customerInvoiceId: invoice.id,
              amount: allocAmount,
              createdByUserId: actorUserId,
            },
          });

          // Update customer invoice
          const newAmountPaid = invoice.amountPaid.add(allocAmount);
          const newAmountDue = invoice.grandTotal.sub(newAmountPaid);
          const newStatus = newAmountDue.isZero()
            ? CustomerInvoiceStatus.PAID
            : CustomerInvoiceStatus.PARTIALLY_PAID;

          await tx.customerInvoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newAmountPaid,
              amountDue: newAmountDue,
              status: newStatus,
            },
          });
        } else if (item.supplierInvoiceId) {
          if (payment.type !== PaymentType.PAYMENT) {
            throw new BadRequestException(
              'Supplier invoices can only be allocated against PAYMENT payments.',
            );
          }

          const invoice = await tx.supplierInvoice.findFirst({
            where: { id: item.supplierInvoiceId, organizationId },
          });
          if (!invoice) {
            throw new NotFoundException(
              `Supplier invoice with ID ${item.supplierInvoiceId} not found in this organization.`,
            );
          }
          if (
            invoice.status !== SupplierInvoiceStatus.POSTED &&
            invoice.status !== SupplierInvoiceStatus.PARTIALLY_PAID
          ) {
            throw new BadRequestException(
              `Supplier invoice ${invoice.invoiceNumber} is not in an open status (Current: ${invoice.status}).`,
            );
          }
          if (invoice.currencyId !== payment.currencyId) {
            throw new BadRequestException(
              `Supplier invoice currency does not match payment currency.`,
            );
          }
          if (payment.supplierId && invoice.supplierId !== payment.supplierId) {
            throw new BadRequestException(
              `Supplier invoice supplier does not match payment supplier.`,
            );
          }
          if (allocAmount.greaterThan(invoice.amountDue)) {
            throw new BadRequestException(
              `Allocation amount (${allocAmount.toString()}) exceeds supplier invoice amount due (${invoice.amountDue.toString()}).`,
            );
          }

          // Create allocation
          await tx.paymentAllocation.create({
            data: {
              organizationId,
              paymentId: payment.id,
              supplierInvoiceId: invoice.id,
              amount: allocAmount,
              createdByUserId: actorUserId,
            },
          });

          // Update supplier invoice
          const newAmountPaid = invoice.amountPaid.add(allocAmount);
          const newAmountDue = invoice.grandTotal.sub(newAmountPaid);
          const newStatus = newAmountDue.isZero()
            ? SupplierInvoiceStatus.PAID
            : SupplierInvoiceStatus.PARTIALLY_PAID;

          await tx.supplierInvoice.update({
            where: { id: invoice.id },
            data: {
              amountPaid: newAmountPaid,
              amountDue: newAmountDue,
              status: newStatus,
            },
          });
        }
      }

      // 3. Update payment status & balances
      const newAllocatedAmount = payment.allocatedAmount.add(totalAllocation);
      const newUnallocatedAmount = payment.amount.sub(newAllocatedAmount);
      const newPaymentStatus = newUnallocatedAmount.isZero()
        ? PaymentStatus.ALLOCATED
        : PaymentStatus.PARTIALLY_ALLOCATED;

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          allocatedAmount: newAllocatedAmount,
          unallocatedAmount: newUnallocatedAmount,
          status: newPaymentStatus,
        },
        include: {
          paymentAccount: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              accountingAccountId: true,
            },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          customer: {
            select: { id: true, code: true, name: true },
          },
          supplier: {
            select: { id: true, code: true, name: true },
          },
          allocations: {
            include: {
              customerInvoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  grandTotal: true,
                  amountDue: true,
                },
              },
              supplierInvoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  grandTotal: true,
                  amountDue: true,
                },
              },
            },
          },
        },
      });

      await this.eventBus.publish({
        eventName: 'PAYMENT_ALLOCATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'payment.allocate',
        resource: 'payment',
        resourceId: payment.id,
        details: {
          allocatedAmount: totalAllocation.toString(),
          newStatus: updated.status,
        },
      });

      return updated;
    });
  }

  /**
   * Void posted payment and reverse General Ledger and invoice settlements.
   */
  async void(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<PaymentWithDetails> {
    const payment = await this.findOne(organizationId, id);

    if (
      payment.status !== PaymentStatus.POSTED &&
      payment.status !== PaymentStatus.PARTIALLY_ALLOCATED &&
      payment.status !== PaymentStatus.ALLOCATED
    ) {
      throw new BadRequestException(
        `Only POSTED, PARTIALLY_ALLOCATED, or ALLOCATED payments can be voided. Current status: ${payment.status}`,
      );
    }

    // Find GL journal entry
    const glEntry = payment.journalEntryId
      ? await this.prisma.journalEntry.findFirst({
          where: { id: payment.journalEntryId, organizationId },
          include: { lines: true },
        })
      : null;

    let reversalNumber: string = '';
    if (glEntry) {
      try {
        const generated = await this.numberingService.nextNumber(
          organizationId,
          'JOURNAL_ENTRY',
          actorUserId,
        );
        reversalNumber = generated.formatted;
      } catch {
        const count = await this.prisma.journalEntry.count({
          where: { organizationId },
        });
        reversalNumber = `JE-${String(count + 1).padStart(6, '0')}`;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Rollback any invoice allocations
      if (payment.allocations && payment.allocations.length > 0) {
        for (const alloc of payment.allocations) {
          const allocAmount = new Prisma.Decimal(alloc.amount);

          if (alloc.customerInvoiceId) {
            const invoice = await tx.customerInvoice.findUniqueOrThrow({
              where: { id: alloc.customerInvoiceId },
            });
            const restoredPaid = invoice.amountPaid.sub(allocAmount);
            const restoredDue = invoice.grandTotal.sub(restoredPaid);
            const revertedStatus = restoredPaid.isZero()
              ? CustomerInvoiceStatus.ISSUED
              : CustomerInvoiceStatus.PARTIALLY_PAID;

            await tx.customerInvoice.update({
              where: { id: invoice.id },
              data: {
                amountPaid: restoredPaid,
                amountDue: restoredDue,
                status: revertedStatus,
              },
            });
          } else if (alloc.supplierInvoiceId) {
            const invoice = await tx.supplierInvoice.findUniqueOrThrow({
              where: { id: alloc.supplierInvoiceId },
            });
            const restoredPaid = invoice.amountPaid.sub(allocAmount);
            const restoredDue = invoice.grandTotal.sub(restoredPaid);
            const revertedStatus = restoredPaid.isZero()
              ? SupplierInvoiceStatus.POSTED
              : SupplierInvoiceStatus.PARTIALLY_PAID;

            await tx.supplierInvoice.update({
              where: { id: invoice.id },
              data: {
                amountPaid: restoredPaid,
                amountDue: restoredDue,
                status: revertedStatus,
              },
            });
          }
        }

        // Delete allocations
        await tx.paymentAllocation.deleteMany({
          where: { paymentId: id },
        });
      }

      // 2. Compensating GL Reversal
      if (glEntry) {
        const reversal = await tx.journalEntry.create({
          data: {
            organizationId,
            fiscalPeriodId: glEntry.fiscalPeriodId,
            entryNumber: reversalNumber,
            entryDate: new Date(),
            description: `Reversal of Payment ${payment.paymentNumber} (${glEntry.entryNumber})`,
            status: JournalEntryStatus.POSTED,
            sourceType: 'REVERSAL',
            sourceId: glEntry.id,
            createdByUserId: actorUserId,
            postedByUserId: actorUserId,
            postedAt: new Date(),
          },
        });

        await tx.journalLine.createMany({
          data: glEntry.lines.map((l) => ({
            journalEntryId: reversal.id,
            organizationId,
            accountId: l.accountId,
            description: `Reversal: ${l.description ?? ''}`.trim() || null,
            debit: l.credit, // Inverted!
            credit: l.debit, // Inverted!
            lineNumber: l.lineNumber,
          })),
        });

        await tx.journalEntry.update({
          where: { id: glEntry.id },
          data: { status: JournalEntryStatus.VOIDED },
        });
      }

      // 3. Mark payment VOIDED
      const voided = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.VOIDED,
          voidedAt: new Date(),
          allocatedAmount: new Prisma.Decimal(0),
          unallocatedAmount: new Prisma.Decimal(0),
        },
        include: {
          paymentAccount: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              accountingAccountId: true,
            },
          },
          currency: {
            select: { id: true, code: true, name: true, symbol: true },
          },
          customer: {
            select: { id: true, code: true, name: true },
          },
          supplier: {
            select: { id: true, code: true, name: true },
          },
          allocations: {
            include: {
              customerInvoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  grandTotal: true,
                  amountDue: true,
                },
              },
              supplierInvoice: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  grandTotal: true,
                  amountDue: true,
                },
              },
            },
          },
        },
      });

      await this.eventBus.publish({
        eventName: 'PAYMENT_VOIDED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'payment.void',
        resource: 'payment',
        resourceId: id,
        details: { paymentNumber: voided.paymentNumber },
      });

      await this.eventBus.publish({
        eventName: 'PAYMENT_ALLOCATION_REVERSED',
        occurredAt: new Date(),
        organizationId,
        actorUserId,
        action: 'payment.allocations_reversed',
        resource: 'payment',
        resourceId: id,
        details: { paymentNumber: voided.paymentNumber },
      });

      return voided;
    });
  }

  /**
   * List payments with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: PaymentQueryDto,
  ): Promise<{
    payments: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = { organizationId };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.paymentAccountId) where.paymentAccountId = query.paymentAccountId;
    if (query.currencyId) where.currencyId = query.currencyId;

    if (query.fromDate || query.toDate) {
      where.paymentDate = {};
      if (query.fromDate) where.paymentDate.gte = new Date(query.fromDate);
      if (query.toDate) where.paymentDate.lte = new Date(query.toDate);
    }

    if (query.search) {
      where.paymentNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: {
          paymentAccount: {
            select: { id: true, code: true, name: true, type: true },
          },
          currency: { select: { id: true, code: true, symbol: true } },
          customer: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          _count: { select: { allocations: true } },
        },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single payment by ID with full details.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PaymentWithDetails> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        customer: {
          select: { id: true, code: true, name: true },
        },
        supplier: {
          select: { id: true, code: true, name: true },
        },
        allocations: {
          include: {
            customerInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                grandTotal: true,
                amountDue: true,
              },
            },
            supplierInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                grandTotal: true,
                amountDue: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Payment with ID ${id} not found in this organization.`,
      );
    }

    return payment;
  }

  /**
   * List unallocated customer receipts.
   */
  async getUnallocatedReceivables(organizationId: string) {
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        type: PaymentType.RECEIPT,
        status: {
          in: [PaymentStatus.POSTED, PaymentStatus.PARTIALLY_ALLOCATED],
        },
        unallocatedAmount: { gt: 0 },
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        currency: { select: { id: true, code: true, symbol: true } },
      },
      orderBy: [{ paymentDate: 'asc' }],
    });
  }

  /**
   * List unallocated supplier payments.
   */
  async getUnallocatedPayables(organizationId: string) {
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        type: PaymentType.PAYMENT,
        status: {
          in: [PaymentStatus.POSTED, PaymentStatus.PARTIALLY_ALLOCATED],
        },
        unallocatedAmount: { gt: 0 },
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        currency: { select: { id: true, code: true, symbol: true } },
      },
      orderBy: [{ paymentDate: 'asc' }],
    });
  }
}
