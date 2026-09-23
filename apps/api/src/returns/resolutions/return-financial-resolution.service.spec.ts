import { Test, TestingModule } from '@nestjs/testing';
import { ReturnFinancialResolutionService } from './return-financial-resolution.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ReturnRequestsService } from '../requests/return-requests.service';
import { ReturnStatus, ReturnResolutionType, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('ReturnFinancialResolutionService', () => {
  let service: ReturnFinancialResolutionService;
  let prisma: PrismaService;
  let returnsService: ReturnRequestsService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';
  const mockReturnId = 'rma-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnFinancialResolutionService,
        {
          provide: PrismaService,
          useValue: {
            returnResolution: { findMany: jest.fn() },
            customerCreditNote: { count: jest.fn().mockResolvedValue(0) },
            customerRefund: { count: jest.fn().mockResolvedValue(0) },
            supplierDebitNote: { count: jest.fn().mockResolvedValue(0) },
            currency: {
              findFirst: jest.fn().mockResolvedValue({ id: 'curr-1' }),
            },
            paymentAccount: {
              findFirst: jest
                .fn()
                .mockResolvedValue({ id: 'pay-1', currencyId: 'curr-1' }),
            },
            returnPolicy: {
              findUnique: jest.fn().mockResolvedValue({
                maxReplacementQty: new Prisma.Decimal(100),
              }),
            },
            $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
              cb({
                currency: {
                  findFirst: jest.fn().mockResolvedValue({ id: 'curr-1' }),
                },
                customerCreditNote: {
                  count: jest.fn().mockResolvedValue(0),
                  create: jest.fn().mockResolvedValue({
                    id: 'crn-1',
                    creditNoteNumber: 'CRN-000001',
                  }),
                },
                customerRefund: {
                  count: jest.fn().mockResolvedValue(0),
                  create: jest.fn().mockResolvedValue({
                    id: 'ref-1',
                    refundNumber: 'REF-000001',
                  }),
                },
                supplierDebitNote: {
                  count: jest.fn().mockResolvedValue(0),
                  create: jest.fn().mockResolvedValue({
                    id: 'dbn-1',
                    debitNoteNumber: 'DBN-000001',
                  }),
                },
                paymentAccount: {
                  findFirst: jest
                    .fn()
                    .mockResolvedValue({ id: 'pay-1', currencyId: 'curr-1' }),
                },
                returnPolicy: {
                  findUnique: jest.fn().mockResolvedValue({
                    maxReplacementQty: new Prisma.Decimal(100),
                  }),
                },
                returnResolution: {
                  create: jest.fn().mockImplementation(({ data }) => ({
                    id: 'res-1',
                    ...data,
                  })),
                },
                returnRequestLine: { update: jest.fn() },
                returnRequest: { update: jest.fn() },
              }),
            ),
          },
        },
        {
          provide: EventBusService,
          useValue: { publish: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: NumberingService,
          useValue: {
            nextNumber: jest
              .fn()
              .mockResolvedValue({ formatted: 'CRN-000001' }),
          },
        },
        {
          provide: ReturnRequestsService,
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReturnFinancialResolutionService>(
      ReturnFinancialResolutionService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    returnsService = module.get<ReturnRequestsService>(ReturnRequestsService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should create credit note resolution and emit event', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      customerId: 'cust-1',
      status: ReturnStatus.DISPOSITION_PENDING,
      returnNumber: 'RMA-000001',
      lines: [],
    });

    const res = await service.createCreditNoteResolution(
      mockOrgId,
      mockReturnId,
      { amount: 500, quantity: 5 },
      mockUserId,
    );

    expect(res.resolutionType).toBe(ReturnResolutionType.CREDIT_NOTE);
    expect(res.amount).toEqual(new Prisma.Decimal(500));
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_CREDIT_NOTE_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should throw BadRequestException if customer return without customerId tries credit note', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      customerId: null,
      status: ReturnStatus.DISPOSITION_PENDING,
    });

    await expect(
      service.createCreditNoteResolution(
        mockOrgId,
        mockReturnId,
        { amount: 500 },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
