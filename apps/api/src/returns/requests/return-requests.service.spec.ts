import { Test, TestingModule } from '@nestjs/testing';
import { ReturnRequestsService } from './return-requests.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { CustomerReturnsService } from '../customer/customer-returns.service';
import { SupplierReturnsService } from '../supplier/supplier-returns.service';
import { BadRequestException } from '@nestjs/common';
import { ReturnStatus, ReturnType, Prisma } from '@prisma/client';

describe('ReturnRequestsService', () => {
  let service: ReturnRequestsService;
  let prisma: PrismaService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';
  const mockReasonId = 'reason-111';
  const mockCustomerId = 'cust-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnRequestsService,
        {
          provide: PrismaService,
          useValue: {
            returnRequest: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
            },
            returnRequestLine: {
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            returnReason: { findFirst: jest.fn() },
            $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
              cb({
                returnRequest: {
                  create: jest.fn().mockImplementation(({ data }) => ({
                    id: 'rma-1',
                    ...data,
                    lines: [],
                    dispositions: [],
                    resolutions: [],
                  })),
                  update: jest.fn().mockImplementation(({ data }) => ({
                    id: 'rma-1',
                    ...data,
                    lines: [],
                    dispositions: [],
                    resolutions: [],
                  })),
                },
                returnRequestLine: {
                  update: jest.fn(),
                  updateMany: jest.fn(),
                },
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
              .mockResolvedValue({ formatted: 'RMA-000001' }),
          },
        },
        {
          provide: CustomerReturnsService,
          useValue: {
            validateEligibility: jest.fn().mockResolvedValue({
              isValid: true,
              validatedLines: [
                {
                  itemId: 'item-1',
                  requestedQuantity: new Prisma.Decimal('5.0000'),
                  unitPrice: new Prisma.Decimal('100.0000'),
                  taxAmount: new Prisma.Decimal('0.0000'),
                  lineAmount: new Prisma.Decimal('500.0000'),
                },
              ],
            }),
          },
        },
        {
          provide: SupplierReturnsService,
          useValue: { validateEligibility: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReturnRequestsService>(ReturnRequestsService);
    prisma = module.get<PrismaService>(PrismaService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should create customer return request in DRAFT status', async () => {
    (prisma.returnReason.findFirst as jest.Mock).mockResolvedValue({
      id: mockReasonId,
      organizationId: mockOrgId,
      isActive: true,
    });

    const res = await service.create(
      mockOrgId,
      {
        returnType: ReturnType.CUSTOMER_RETURN,
        customerId: mockCustomerId,
        reasonId: mockReasonId,
        lines: [{ itemId: 'item-1', requestedQuantity: 5 }],
      },
      mockUserId,
    );

    expect(res.returnNumber).toBe('RMA-000001');
    expect(res.status).toBe(ReturnStatus.DRAFT);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should transition return from DRAFT to SUBMITTED', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'rma-1',
      organizationId: mockOrgId,
      status: ReturnStatus.DRAFT,
      lines: [],
      dispositions: [],
      resolutions: [],
    });
    (prisma.returnRequest.update as jest.Mock).mockResolvedValue({
      id: 'rma-1',
      status: ReturnStatus.SUBMITTED,
      lines: [],
      dispositions: [],
      resolutions: [],
    });

    const res = await service.submit(mockOrgId, 'rma-1', mockUserId);
    expect(res.status).toBe(ReturnStatus.SUBMITTED);
  });

  it('should reject submission if return is not in DRAFT status', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'rma-1',
      organizationId: mockOrgId,
      status: ReturnStatus.AUTHORIZED,
      lines: [],
      dispositions: [],
      resolutions: [],
    });

    await expect(
      service.submit(mockOrgId, 'rma-1', mockUserId),
    ).rejects.toThrow(BadRequestException);
  });
});
