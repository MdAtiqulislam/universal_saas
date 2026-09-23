import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ReturnRequestsService } from '../requests/return-requests.service';
import {
  CreateCreditNoteResolutionDto,
  CreateRefundResolutionDto,
  CreateDebitNoteResolutionDto,
  CreateReplacementResolutionDto,
} from './dto/return-resolution.dto';
import {
  ReturnResolution,
  ReturnResolutionType,
  ReturnStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ReturnFinancialResolutionService {
  private readonly logger = new Logger(ReturnFinancialResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly returnsService: ReturnRequestsService,
  ) {}

  async findResolutions(
    organizationId: string,
    returnRequestId: string,
  ): Promise<ReturnResolution[]> {
    return this.prisma.returnResolution.findMany({
      where: { organizationId, returnRequestId },
      include: {
        returnLine: {
          include: { item: true, variant: true },
        },
        customerCreditNote: true,
        customerRefund: true,
        supplierDebitNote: true,
        replacementSalesOrder: true,
      },
      orderBy: { processedAt: 'desc' },
    });
  }

  /**
   * 1. Create Credit Note Resolution (Customer Return)
   */
  async createCreditNoteResolution(
    organizationId: string,
    returnId: string,
    dto: CreateCreditNoteResolutionDto,
    userId: string,
  ): Promise<ReturnResolution> {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (!returnRequest.customerId) {
      throw new BadRequestException(
        'Cannot create a Credit Note resolution on a return without a customer.',
      );
    }

    if (
      returnRequest.status === ReturnStatus.CLOSED ||
      returnRequest.status === ReturnStatus.REJECTED ||
      returnRequest.status === ReturnStatus.CANCELLED ||
      returnRequest.status === ReturnStatus.VOIDED
    ) {
      throw new BadRequestException(
        `Cannot create financial resolution for return in status: ${returnRequest.status}.`,
      );
    }

    const resolutionAmount = new Prisma.Decimal(dto.amount);
    if (resolutionAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Resolution amount must be strictly positive.',
      );
    }

    const resolutionQty = new Prisma.Decimal(dto.quantity ?? 0);

    const resolution = await this.prisma.$transaction(async (tx) => {
      let creditNoteId = dto.existingCreditNoteId;

      if (!creditNoteId) {
        // Find default organization currency
        const defaultCurrency = await tx.currency.findFirst({
          where: { isActive: true },
        });

        if (!defaultCurrency) {
          throw new BadRequestException('No active currency configured.');
        }

        // Generate Credit Note Number
        let creditNoteNumber: string;
        try {
          const seq = await this.numberingService.nextNumber(
            organizationId,
            'CRN',
          );
          creditNoteNumber = seq.formatted;
        } catch {
          const count = await tx.customerCreditNote.count({
            where: { organizationId },
          });
          creditNoteNumber = `CRN-${String(count + 1).padStart(6, '0')}`;
        }

        const newCreditNote = await tx.customerCreditNote.create({
          data: {
            organizationId,
            creditNoteNumber,
            customerId: returnRequest.customerId!,
            salesOrderId: returnRequest.salesOrderId ?? null,
            deliveryOrderId: returnRequest.deliveryOrderId ?? null,
            currencyId: defaultCurrency.id,
            creditDate: new Date(),
            reason: `Return resolution for RMA ${returnRequest.returnNumber}`,
            subtotal: resolutionAmount,
            grandTotal: resolutionAmount,
            remainingAmount: resolutionAmount,
            status: 'DRAFT',
            createdByUserId: userId,
          },
        });

        creditNoteId = newCreditNote.id;
      }

      // Create resolution record
      const res = await tx.returnResolution.create({
        data: {
          organizationId,
          returnRequestId: returnId,
          returnLineId: dto.returnLineId ?? null,
          resolutionType: ReturnResolutionType.CREDIT_NOTE,
          amount: resolutionAmount,
          quantity: resolutionQty,
          customerCreditNoteId: creditNoteId,
          notes: dto.notes?.trim() ?? null,
          processedByUserId: userId,
        },
        include: {
          customerCreditNote: true,
        },
      });

      // Update line financial resolution counter if specified
      if (dto.returnLineId) {
        const line = returnRequest.lines.find((l) => l.id === dto.returnLineId);
        if (line) {
          const newFinQty = new Prisma.Decimal(
            line.financialResolutionQuantity,
          ).plus(resolutionQty);
          await tx.returnRequestLine.update({
            where: { id: dto.returnLineId },
            data: {
              financialResolutionQuantity: newFinQty,
              status: 'RESOLVED',
            },
          });
        }
      }

      // Transition return status to RESOLVED
      await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      return res;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_CREDIT_NOTE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.resolutions.credit-note',
      resource: 'return_resolution',
      resourceId: resolution.id,
      details: {
        returnNumber: returnRequest.returnNumber,
        amount: resolution.amount,
        creditNoteId: resolution.customerCreditNoteId,
      },
    });

    return resolution;
  }

  /**
   * 2. Create Refund Resolution (Customer Return)
   */
  async createRefundResolution(
    organizationId: string,
    returnId: string,
    dto: CreateRefundResolutionDto,
    userId: string,
  ): Promise<ReturnResolution> {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (!returnRequest.customerId) {
      throw new BadRequestException(
        'Cannot create a Refund resolution on a return without a customer.',
      );
    }

    if (
      returnRequest.status === ReturnStatus.CLOSED ||
      returnRequest.status === ReturnStatus.REJECTED ||
      returnRequest.status === ReturnStatus.CANCELLED ||
      returnRequest.status === ReturnStatus.VOIDED
    ) {
      throw new BadRequestException(
        `Cannot create financial resolution for return in status: ${returnRequest.status}.`,
      );
    }

    const refundAmount = new Prisma.Decimal(dto.amount);
    if (refundAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Refund amount must be strictly positive.');
    }

    const resolution = await this.prisma.$transaction(async (tx) => {
      // Resolve payment account
      let paymentAccountId = dto.paymentAccountId;
      let currencyId: string;

      if (!paymentAccountId) {
        const defaultAcct = await tx.paymentAccount.findFirst({
          where: { organizationId, isActive: true, deletedAt: null },
        });
        if (!defaultAcct) {
          throw new BadRequestException(
            'No active payment account available for refund.',
          );
        }
        paymentAccountId = defaultAcct.id;
        currencyId = defaultAcct.currencyId;
      } else {
        const acct = await tx.paymentAccount.findFirst({
          where: { id: paymentAccountId, organizationId, isActive: true },
        });
        if (!acct) {
          throw new NotFoundException(
            `Payment account ${paymentAccountId} not found.`,
          );
        }
        currencyId = acct.currencyId;
      }

      // Generate refund number
      let refundNumber: string;
      try {
        const seq = await this.numberingService.nextNumber(
          organizationId,
          'REF',
        );
        refundNumber = seq.formatted;
      } catch {
        const count = await tx.customerRefund.count({
          where: { organizationId },
        });
        refundNumber = `REF-${String(count + 1).padStart(6, '0')}`;
      }

      const customerRefund = await tx.customerRefund.create({
        data: {
          organizationId,
          refundNumber,
          customerId: returnRequest.customerId!,
          creditNoteId: dto.creditNoteId ?? null,
          paymentAccountId,
          currencyId,
          refundDate: new Date(),
          amount: refundAmount,
          reason: `RMA ${returnRequest.returnNumber} customer refund`,
          status: 'DRAFT',
          createdByUserId: userId,
        },
      });

      const res = await tx.returnResolution.create({
        data: {
          organizationId,
          returnRequestId: returnId,
          returnLineId: dto.returnLineId ?? null,
          resolutionType: ReturnResolutionType.REFUND,
          amount: refundAmount,
          customerRefundId: customerRefund.id,
          notes: dto.notes?.trim() ?? null,
          processedByUserId: userId,
        },
        include: {
          customerRefund: true,
        },
      });

      // Transition return status to RESOLVED
      await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      return res;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_REFUND_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.resolutions.refund',
      resource: 'return_resolution',
      resourceId: resolution.id,
      details: {
        returnNumber: returnRequest.returnNumber,
        amount: resolution.amount,
        refundId: resolution.customerRefundId,
      },
    });

    return resolution;
  }

  /**
   * 3. Create Debit Note Resolution (Supplier Return)
   */
  async createDebitNoteResolution(
    organizationId: string,
    returnId: string,
    dto: CreateDebitNoteResolutionDto,
    userId: string,
  ): Promise<ReturnResolution> {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (!returnRequest.supplierId) {
      throw new BadRequestException(
        'Cannot create a Debit Note resolution on a return without a supplier.',
      );
    }

    if (
      returnRequest.status === ReturnStatus.CLOSED ||
      returnRequest.status === ReturnStatus.REJECTED ||
      returnRequest.status === ReturnStatus.CANCELLED ||
      returnRequest.status === ReturnStatus.VOIDED
    ) {
      throw new BadRequestException(
        `Cannot create financial resolution for return in status: ${returnRequest.status}.`,
      );
    }

    const resolutionAmount = new Prisma.Decimal(dto.amount);
    if (resolutionAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Resolution amount must be strictly positive.',
      );
    }

    const resolutionQty = new Prisma.Decimal(dto.quantity ?? 0);

    const resolution = await this.prisma.$transaction(async (tx) => {
      let debitNoteId = dto.existingDebitNoteId;

      if (!debitNoteId) {
        const defaultCurrency = await tx.currency.findFirst({
          where: { isActive: true },
        });

        if (!defaultCurrency) {
          throw new BadRequestException('No active currency configured.');
        }

        // Generate Debit Note Number
        let debitNoteNumber: string;
        try {
          const seq = await this.numberingService.nextNumber(
            organizationId,
            'DBN',
          );
          debitNoteNumber = seq.formatted;
        } catch {
          const count = await tx.supplierDebitNote.count({
            where: { organizationId },
          });
          debitNoteNumber = `DBN-${String(count + 1).padStart(6, '0')}`;
        }

        const newDebitNote = await tx.supplierDebitNote.create({
          data: {
            organizationId,
            debitNoteNumber,
            supplierId: returnRequest.supplierId!,
            purchaseOrderId: returnRequest.purchaseOrderId ?? null,
            currencyId: defaultCurrency.id,
            debitDate: new Date(),
            reason: `Supplier return resolution for RMA ${returnRequest.returnNumber}`,
            subtotal: resolutionAmount,
            grandTotal: resolutionAmount,
            remainingAmount: resolutionAmount,
            status: 'DRAFT',
            createdByUserId: userId,
          },
        });

        debitNoteId = newDebitNote.id;
      }

      const res = await tx.returnResolution.create({
        data: {
          organizationId,
          returnRequestId: returnId,
          returnLineId: dto.returnLineId ?? null,
          resolutionType: ReturnResolutionType.DEBIT_NOTE,
          amount: resolutionAmount,
          quantity: resolutionQty,
          supplierDebitNoteId: debitNoteId,
          notes: dto.notes?.trim() ?? null,
          processedByUserId: userId,
        },
        include: {
          supplierDebitNote: true,
        },
      });

      // Update line financial resolution counter if specified
      if (dto.returnLineId) {
        const line = returnRequest.lines.find((l) => l.id === dto.returnLineId);
        if (line) {
          const newFinQty = new Prisma.Decimal(
            line.financialResolutionQuantity,
          ).plus(resolutionQty);
          await tx.returnRequestLine.update({
            where: { id: dto.returnLineId },
            data: {
              financialResolutionQuantity: newFinQty,
              status: 'RESOLVED',
            },
          });
        }
      }

      // Transition return status to RESOLVED
      await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      return res;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_DEBIT_NOTE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.resolutions.debit-note',
      resource: 'return_resolution',
      resourceId: resolution.id,
      details: {
        returnNumber: returnRequest.returnNumber,
        amount: resolution.amount,
        debitNoteId: resolution.supplierDebitNoteId,
      },
    });

    return resolution;
  }

  /**
   * 4. Create Replacement Resolution
   */
  async createReplacementResolution(
    organizationId: string,
    returnId: string,
    dto: CreateReplacementResolutionDto,
    userId: string,
  ): Promise<ReturnResolution> {
    const returnRequest = await this.returnsService.findOne(
      organizationId,
      returnId,
    );

    if (
      returnRequest.status === ReturnStatus.CLOSED ||
      returnRequest.status === ReturnStatus.REJECTED ||
      returnRequest.status === ReturnStatus.CANCELLED ||
      returnRequest.status === ReturnStatus.VOIDED
    ) {
      throw new BadRequestException(
        `Cannot create replacement resolution for return in status: ${returnRequest.status}.`,
      );
    }

    const targetLine = returnRequest.lines.find(
      (l) => l.id === dto.returnLineId,
    );
    if (!targetLine) {
      throw new BadRequestException(
        `Return line ${dto.returnLineId} not found on this RMA.`,
      );
    }

    const replaceQty = new Prisma.Decimal(dto.quantity);
    if (replaceQty.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Replacement quantity must be strictly positive.',
      );
    }

    const resolution = await this.prisma.$transaction(async (tx) => {
      // Check max replacement policy
      const policy = await tx.returnPolicy.findUnique({
        where: { organizationId },
      });
      if (policy && replaceQty.greaterThan(policy.maxReplacementQty)) {
        throw new BadRequestException(
          `Replacement quantity (${replaceQty.toString()}) exceeds max allowable replacement quantity (${policy.maxReplacementQty.toString()}) defined in return policy.`,
        );
      }

      // Update line replacement quantity
      const newRepQty = new Prisma.Decimal(targetLine.replacementQuantity).plus(
        replaceQty,
      );
      await tx.returnRequestLine.update({
        where: { id: dto.returnLineId },
        data: {
          replacementQuantity: newRepQty,
          status: 'RESOLVED',
        },
      });

      const res = await tx.returnResolution.create({
        data: {
          organizationId,
          returnRequestId: returnId,
          returnLineId: dto.returnLineId,
          resolutionType: ReturnResolutionType.REPLACEMENT,
          quantity: replaceQty,
          amount: replaceQty.times(new Prisma.Decimal(targetLine.unitPrice)),
          replacementSalesOrderId: dto.replacementSalesOrderId ?? null,
          replacementReference:
            dto.replacementReference?.trim() ??
            `REP-${returnRequest.returnNumber}`,
          notes: dto.notes?.trim() ?? null,
          processedByUserId: userId,
        },
        include: {
          replacementSalesOrder: true,
        },
      });

      // Transition return status to RESOLVED
      await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      return res;
    });

    await this.eventBus.publish({
      eventName: 'RETURN_REPLACEMENT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'returns.resolutions.replacement',
      resource: 'return_resolution',
      resourceId: resolution.id,
      details: {
        returnNumber: returnRequest.returnNumber,
        lineId: dto.returnLineId,
        quantity: resolution.quantity,
      },
    });

    return resolution;
  }
}
