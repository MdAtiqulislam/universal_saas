import { Test, TestingModule } from '@nestjs/testing';
import { ReturnRequestsService } from './requests/return-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { CustomerReturnsService } from './customer/customer-returns.service';
import { SupplierReturnsService } from './supplier/supplier-returns.service';
import { ReturnStatus, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Returns Authorization Workflow Spec', () => {
  let service: ReturnRequestsService;
  let prisma: PrismaService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';
  const mockReturnId = 'rma-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnRequestsService,
        {
          provide: PrismaService,
          useValue: {
            returnRequest: { findFirst: jest.fn(), update: jest.fn() },
            returnRequestLine: { update: jest.fn() },
            $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
              cb({
                returnRequestLine: { update: jest.fn() },
                returnRequest: {
                  update: jest.fn().mockImplementation(({ data }) => ({
                    id: mockReturnId,
                    returnNumber: 'RMA-000001',
                    status: data.status,
                    authorizedAt: data.authorizedAt,
                    authorizedByUserId: data.authorizedByUserId,
                    lines: [],
                    dispositions: [],
                    resolutions: [],
                  })),
                },
              }),
            ),
          },
        },
        {
          provide: EventBusService,
          useValue: { publish: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: CustomerReturnsService, useValue: {} },
        { provide: SupplierReturnsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ReturnRequestsService>(ReturnRequestsService);
    prisma = module.get<PrismaService>(PrismaService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should authorize return request, assign authorized quantities, and publish RETURN_AUTHORIZED', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      organizationId: mockOrgId,
      status: ReturnStatus.UNDER_REVIEW,
      returnNumber: 'RMA-000001',
      lines: [
        {
          id: 'line-1',
          requestedQuantity: new Prisma.Decimal('10.0000'),
          authorizedQuantity: new Prisma.Decimal('0.0000'),
        },
      ],
    });

    const res = await service.authorize(
      mockOrgId,
      mockReturnId,
      {
        authorizationNotes: 'Approved full return',
        lineAuthorizations: [{ lineId: 'line-1', authorizedQuantity: 10 }],
      },
      mockUserId,
    );

    expect(res.status).toBe(ReturnStatus.AUTHORIZED);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_AUTHORIZED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should reject authorization if authorized quantity exceeds requested quantity', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      organizationId: mockOrgId,
      status: ReturnStatus.UNDER_REVIEW,
      lines: [
        {
          id: 'line-1',
          requestedQuantity: new Prisma.Decimal('5.0000'),
          authorizedQuantity: new Prisma.Decimal('0.0000'),
        },
      ],
    });

    await expect(
      service.authorize(
        mockOrgId,
        mockReturnId,
        {
          lineAuthorizations: [{ lineId: 'line-1', authorizedQuantity: 10 }], // 10 > 5
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
