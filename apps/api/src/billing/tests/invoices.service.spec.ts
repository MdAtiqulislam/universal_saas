import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from '../services/invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingInvoiceRepository } from '../repositories/billing-invoice.repository';
import { AuditService } from '../../audit/audit.service';
import { EventBusService } from '../../events/event-bus.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { BillingInvoiceStatus, BillingPaymentStatus } from '@prisma/client';

describe('InvoicesService (M42)', () => {
  let service: InvoicesService;
  let prisma: {
    billingInvoice: {
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let invoiceRepo: {
    findInvoiceById: jest.Mock;
    getAvailableCredit: jest.Mock;
    consumeCredit: jest.Mock;
    listInvoices: jest.Mock;
  };
  let audit: {
    record: jest.Mock;
  };
  let eventBus: {
    publish: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      billingInvoice: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    invoiceRepo = {
      findInvoiceById: jest.fn(),
      getAvailableCredit: jest.fn(),
      consumeCredit: jest.fn(),
      listInvoices: jest.fn(),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillingInvoiceRepository, useValue: invoiceRepo },
        { provide: AuditService, useValue: audit },
        { provide: EventBusService, useValue: eventBus },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe('createInvoice', () => {
    it('should reject invoice creation without line items', async () => {
      await expect(
        service.createInvoice('org-1', {
          lineItems: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should compute deterministic total amount: subtotal + tax - discount - credit (INV-447)', async () => {
      invoiceRepo.getAvailableCredit.mockResolvedValue(1000); // 10.00 credit available
      invoiceRepo.consumeCredit.mockResolvedValue(undefined);

      prisma.billingInvoice.create.mockImplementation((args) =>
        Promise.resolve({ id: 'inv-created', ...args.data }),
      );

      const res = await service.createInvoice('org-1', {
        currency: 'USD',
        taxAmount: 500, // $5.00 tax
        discountAmount: 1000, // $10.00 discount
        lineItems: [
          { description: 'Pro Plan', quantity: 1, unitAmount: 10000 }, // $100.00
          { description: 'Extra Seat', quantity: 2, unitAmount: 1000 }, // $20.00
        ],
      });

      // Subtotal = 10000 + 2000 = 12000
      // Discount = 1000 => 11000
      // Tax = 500 => 11500
      // Credit = 1000 => Total = 10500 ($105.00)
      expect(res.subtotal).toBe(12000);
      expect(res.discountAmount).toBe(1000);
      expect(res.taxAmount).toBe(500);
      expect(res.creditApplied).toBe(1000);
      expect(res.totalAmount).toBe(10500);
      expect(res.amountDue).toBe(10500);
      expect(invoiceRepo.consumeCredit).toHaveBeenCalledWith('org-1', 1000);
    });
  });

  describe('finalizeInvoice', () => {
    it('should throw ForbiddenException if invoice belongs to a different organization (INV-444)', async () => {
      invoiceRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-tenant-1',
        status: BillingInvoiceStatus.DRAFT,
      });

      await expect(
        service.finalizeInvoice('inv-1', 'org-tenant-foreign'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject finalization if already finalized (INV-445)', async () => {
      invoiceRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        status: BillingInvoiceStatus.OPEN,
        finalizedAt: new Date(),
      });

      await expect(service.finalizeInvoice('inv-1', 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should transition DRAFT invoice to OPEN when totalAmount > 0', async () => {
      invoiceRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        status: BillingInvoiceStatus.DRAFT,
        finalizedAt: null,
        totalAmount: 5000,
      });

      prisma.billingInvoice.update.mockResolvedValue({
        id: 'inv-1',
        status: BillingInvoiceStatus.OPEN,
        invoiceNumber: 'INV-123',
        totalAmount: 5000,
      });

      const res = await service.finalizeInvoice('inv-1', 'org-1');
      expect(res.status).toBe(BillingInvoiceStatus.OPEN);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'billing.invoice.finalized' }),
      );
    });
  });

  describe('applyPayment', () => {
    it('should reject payment exceeding invoice amountDue (INV-448)', async () => {
      invoiceRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        status: BillingInvoiceStatus.OPEN,
        totalAmount: 10000,
        amountPaid: 5000,
        amountDue: 5000,
      });

      await expect(
        service.applyPayment('inv-1', 'org-1', {
          amount: 6000, // Exceeds 5000 due
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark invoice PAID upon full payment application', async () => {
      invoiceRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        status: BillingInvoiceStatus.OPEN,
        currency: 'USD',
        totalAmount: 5000,
        amountPaid: 0,
        amountDue: 5000,
        invoiceNumber: 'INV-5000',
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          billingPayment: {
            create: jest.fn().mockResolvedValue({
              id: 'pay-1',
              status: BillingPaymentStatus.SUCCEEDED,
              amount: 5000,
            }),
          },
          billingInvoice: {
            update: jest.fn().mockResolvedValue({
              id: 'inv-1',
              status: BillingInvoiceStatus.PAID,
              amountPaid: 5000,
              amountDue: 0,
            }),
          },
        };
        return await callback(tx);
      });

      const result = await service.applyPayment('inv-1', 'org-1', {
        amount: 5000,
      });

      expect(result.invoice.status).toBe(BillingInvoiceStatus.PAID);
      expect(result.invoice.amountDue).toBe(0);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'billing.payment.succeeded' }),
      );
    });
  });
});
