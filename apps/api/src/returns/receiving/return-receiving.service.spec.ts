import { Test, TestingModule } from '@nestjs/testing';
import { ReturnReceivingService } from './return-receiving.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ReturnRequestsService } from '../requests/return-requests.service';
import { ReturnStatus, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('ReturnReceivingService', () => {
  let service: ReturnReceivingService;
  let prisma: PrismaService;
  let returnsService: ReturnRequestsService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';
  const mockReturnId = 'rma-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnReceivingService,
        {
          provide: PrismaService,
          useValue: {
            location: { findFirst: jest.fn() },
            returnPolicy: { findUnique: jest.fn() },
            $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
              cb({
                returnRequestLine: { update: jest.fn() },
                returnPolicy: {
                  findUnique: jest
                    .fn()
                    .mockResolvedValue({ requireInspection: true }),
                },
                returnRequest: {
                  update: jest.fn().mockImplementation(({ data }) => ({
                    id: mockReturnId,
                    returnNumber: 'RMA-000001',
                    status: data.status,
                    lines: [],
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
        {
          provide: ReturnRequestsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReturnReceivingService>(ReturnReceivingService);
    prisma = module.get<PrismaService>(PrismaService);
    returnsService = module.get<ReturnRequestsService>(ReturnRequestsService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should receive authorized returned items into warehouse location', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      status: ReturnStatus.AUTHORIZED,
      reason: { requiresInspection: true },
      lines: [
        {
          id: 'line-1',
          authorizedQuantity: new Prisma.Decimal('10.0000'),
          receivedQuantity: new Prisma.Decimal('0.0000'),
        },
      ],
    });

    (prisma.location.findFirst as jest.Mock).mockResolvedValue({
      id: 'loc-1',
      organizationId: mockOrgId,
      isActive: true,
    });

    const res = await service.receiveReturn(
      mockOrgId,
      mockReturnId,
      {
        warehouseId: 'loc-1',
        locationId: 'loc-2',
        items: [{ lineId: 'line-1', receivedQuantity: 10 }],
      },
      mockUserId,
    );

    expect(res.status).toBe(ReturnStatus.INSPECTION_REQUIRED);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_RECEIVED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should throw BadRequestException if receive quantity exceeds authorized quantity', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      status: ReturnStatus.AUTHORIZED,
      reason: { requiresInspection: true },
      lines: [
        {
          id: 'line-1',
          authorizedQuantity: new Prisma.Decimal('5.0000'),
          receivedQuantity: new Prisma.Decimal('0.0000'),
        },
      ],
    });

    (prisma.location.findFirst as jest.Mock).mockResolvedValue({
      id: 'loc-1',
      organizationId: mockOrgId,
      isActive: true,
    });

    await expect(
      service.receiveReturn(
        mockOrgId,
        mockReturnId,
        {
          warehouseId: 'loc-1',
          locationId: 'loc-2',
          items: [{ lineId: 'line-1', receivedQuantity: 10 }], // 10 > 5
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
