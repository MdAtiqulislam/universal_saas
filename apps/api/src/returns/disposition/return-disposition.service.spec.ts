import { Test, TestingModule } from '@nestjs/testing';
import { ReturnDispositionService } from './return-disposition.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ReturnRequestsService } from '../requests/return-requests.service';
import { ReturnStatus, ReturnDispositionType, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('ReturnDispositionService', () => {
  let service: ReturnDispositionService;
  let prisma: PrismaService;
  let returnsService: ReturnRequestsService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';
  const mockReturnId = 'rma-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnDispositionService,
        {
          provide: PrismaService,
          useValue: {
            returnDispositionRecord: { findMany: jest.fn(), create: jest.fn() },
            location: { findFirst: jest.fn() },
            $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
              cb({
                returnDispositionRecord: {
                  findMany: jest.fn().mockResolvedValue([]),
                  create: jest.fn().mockImplementation(({ data }) => ({
                    id: 'disp-1',
                    ...data,
                  })),
                },
                location: {
                  findFirst: jest.fn().mockResolvedValue({ id: 'loc-1' }),
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
          provide: ReturnRequestsService,
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReturnDispositionService>(ReturnDispositionService);
    prisma = module.get<PrismaService>(PrismaService);
    returnsService = module.get<ReturnRequestsService>(ReturnRequestsService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should execute RESTOCK disposition record and emit RESTOCKED event', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      status: ReturnStatus.DISPOSITION_PENDING,
      lines: [
        {
          id: 'line-1',
          acceptedQuantity: new Prisma.Decimal('10.0000'),
          receivedQuantity: new Prisma.Decimal('10.0000'),
          authorizedQuantity: new Prisma.Decimal('10.0000'),
        },
      ],
    });

    const res = await service.createDispositions(
      mockOrgId,
      mockReturnId,
      {
        dispositions: [
          {
            returnLineId: 'line-1',
            dispositionType: ReturnDispositionType.RESTOCK,
            quantity: 10,
            warehouseId: 'wh-1',
            locationId: 'loc-1',
          },
        ],
      },
      mockUserId,
    );

    expect(res).toHaveLength(1);
    expect(res[0].dispositionType).toBe(ReturnDispositionType.RESTOCK);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_RESTOCKED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should throw BadRequestException if disposition quantity exceeds accepted quantity', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      status: ReturnStatus.DISPOSITION_PENDING,
      lines: [
        {
          id: 'line-1',
          acceptedQuantity: new Prisma.Decimal('5.0000'),
          receivedQuantity: new Prisma.Decimal('5.0000'),
          authorizedQuantity: new Prisma.Decimal('5.0000'),
        },
      ],
    });

    await expect(
      service.createDispositions(
        mockOrgId,
        mockReturnId,
        {
          dispositions: [
            {
              returnLineId: 'line-1',
              dispositionType: ReturnDispositionType.RESTOCK,
              quantity: 10, // 10 > 5
              warehouseId: 'wh-1',
              locationId: 'loc-1',
            },
          ],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
