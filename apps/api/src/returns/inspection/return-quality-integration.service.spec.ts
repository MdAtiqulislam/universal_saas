import { Test, TestingModule } from '@nestjs/testing';
import { ReturnQualityIntegrationService } from './return-quality-integration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ReturnRequestsService } from '../requests/return-requests.service';
import { ReturnStatus, Prisma } from '@prisma/client';

describe('ReturnQualityIntegrationService', () => {
  let service: ReturnQualityIntegrationService;
  let prisma: PrismaService;
  let returnsService: ReturnRequestsService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';
  const mockReturnId = 'rma-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnQualityIntegrationService,
        {
          provide: PrismaService,
          useValue: {
            qualityInspectionLot: {
              findFirst: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn(),
            },
            $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
              cb({
                qualityInspectionLot: {
                  create: jest.fn().mockResolvedValue({
                    id: 'qlot-1',
                    lotNumber: 'QLOT-000001',
                    totalQuantity: new Prisma.Decimal('10.0000'),
                  }),
                },
                returnRequest: {
                  update: jest.fn().mockImplementation(({ data }) => ({
                    id: mockReturnId,
                    returnNumber: 'RMA-000001',
                    status: data.status,
                    lines: [],
                  })),
                },
                returnRequestLine: {
                  update: jest.fn(),
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
              .mockResolvedValue({ formatted: 'QLOT-000001' }),
          },
        },
        {
          provide: ReturnRequestsService,
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReturnQualityIntegrationService>(
      ReturnQualityIntegrationService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    returnsService = module.get<ReturnRequestsService>(ReturnRequestsService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should request M31 quality inspection lot for received return', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      status: ReturnStatus.INSPECTION_REQUIRED,
      returnNumber: 'RMA-000001',
      customerId: 'cust-1',
      lines: [
        {
          id: 'line-1',
          itemId: 'item-1',
          receivedQuantity: new Prisma.Decimal('10.0000'),
        },
      ],
    });

    const res = await service.requestInspection(
      mockOrgId,
      mockReturnId,
      {
        warehouseId: 'wh-1',
        locationId: 'loc-1',
      },
      mockUserId,
    );

    expect(res.inspectionLot.lotNumber).toBe('QLOT-000001');
    expect(res.updatedReturn.status).toBe(ReturnStatus.INSPECTING);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_INSPECTION_REQUESTED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should sync inspection lot decision ACCEPT to line quantities', async () => {
    (returnsService.findOne as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      status: ReturnStatus.INSPECTING,
      returnNumber: 'RMA-000001',
      inspectionLotId: 'qlot-1',
      lines: [
        {
          id: 'line-1',
          receivedQuantity: new Prisma.Decimal('10.0000'),
        },
      ],
    });

    (prisma.qualityInspectionLot.findFirst as jest.Mock).mockResolvedValue({
      id: 'qlot-1',
      decision: 'ACCEPT',
      passedQuantity: new Prisma.Decimal('10.0000'),
      failedQuantity: new Prisma.Decimal('0.0000'),
    });

    const res = await service.syncInspectionResult(
      mockOrgId,
      mockReturnId,
      mockUserId,
    );

    expect(res.status).toBe(ReturnStatus.DISPOSITION_PENDING);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_INSPECTED',
        organizationId: mockOrgId,
      }),
    );
  });
});
