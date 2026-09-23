import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockTransferStatus, StockMovementType } from '@prisma/client';
import { TransfersService } from './transfers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { BalancesService } from '../balances/balances.service';

describe('TransfersService (M09)', () => {
  let service: TransfersService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingServiceMock: any;
  let balancesServiceMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';
  const mockSourceId = '33333333-3333-3333-3333-333333333333';
  const mockDestId = '44444444-4444-4444-4444-444444444444';
  const mockItemId = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      location: {
        findFirst: jest.fn(),
      },
      stockTransfer: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingServiceMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'TRF-000042' }),
    };

    balancesServiceMock = {
      applyStockMovement: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingServiceMock },
        { provide: BalancesService, useValue: balancesServiceMock },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should create a transfer in DRAFT status with generated transfer number', async () => {
    prismaMock.location.findFirst
      .mockResolvedValueOnce({ id: mockSourceId, code: 'WH-A' })
      .mockResolvedValueOnce({ id: mockDestId, code: 'WH-B' });

    prismaMock.stockTransfer.create.mockResolvedValue({
      id: 'trf-1',
      organizationId: mockOrgId,
      transferNumber: 'TRF-000042',
      sourceLocationId: mockSourceId,
      destinationLocationId: mockDestId,
      status: StockTransferStatus.DRAFT,
    });

    const result = await service.createTransfer(
      mockOrgId,
      {
        sourceLocationId: mockSourceId,
        destinationLocationId: mockDestId,
        reason: 'Stock replenishment',
      },
      mockUserId,
    );

    expect(result.transferNumber).toBe('TRF-000042');
    expect(result.status).toBe(StockTransferStatus.DRAFT);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'STOCK_TRANSFER_CREATED',
      }),
    );
  });

  it('2. should reject transfer creation when source equals destination', async () => {
    await expect(
      service.createTransfer(
        mockOrgId,
        {
          sourceLocationId: mockSourceId,
          destinationLocationId: mockSourceId,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should complete transfer atomically with TRANSFER_OUT and TRANSFER_IN', async () => {
    const draftTransfer = {
      id: 'trf-1',
      organizationId: mockOrgId,
      transferNumber: 'TRF-000042',
      sourceLocationId: mockSourceId,
      destinationLocationId: mockDestId,
      status: StockTransferStatus.DRAFT,
      sourceLocation: { code: 'WH-A' },
      destinationLocation: { code: 'WH-B' },
    };

    const completedTransfer = {
      ...draftTransfer,
      status: StockTransferStatus.COMPLETED,
    };

    prismaMock.stockTransfer.findFirst
      .mockResolvedValueOnce(draftTransfer)
      .mockResolvedValueOnce(completedTransfer);

    prismaMock.stockTransfer.update.mockResolvedValue(completedTransfer);

    const result = await service.completeTransfer(
      mockOrgId,
      'trf-1',
      {
        lines: [
          {
            itemId: mockItemId,
            quantity: 10,
          },
        ],
      },
      mockUserId,
    );

    // Verify TRANSFER_OUT from source
    expect(balancesServiceMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        locationId: mockSourceId,
        movementType: StockMovementType.TRANSFER_OUT,
        quantity: 10,
      }),
      mockUserId,
      prismaMock,
    );

    // Verify TRANSFER_IN to destination
    expect(balancesServiceMock.applyStockMovement).toHaveBeenCalledWith(
      mockOrgId,
      expect.objectContaining({
        locationId: mockDestId,
        movementType: StockMovementType.TRANSFER_IN,
        quantity: 10,
      }),
      mockUserId,
      prismaMock,
    );

    expect(result.status).toBe(StockTransferStatus.COMPLETED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'STOCK_TRANSFER_COMPLETED',
      }),
    );
  });

  it('4. should reject completing non-DRAFT transfer', async () => {
    prismaMock.stockTransfer.findFirst.mockResolvedValue({
      id: 'trf-1',
      organizationId: mockOrgId,
      status: StockTransferStatus.COMPLETED,
      sourceLocation: { code: 'WH-A' },
      destinationLocation: { code: 'WH-B' },
    });

    await expect(
      service.completeTransfer(
        mockOrgId,
        'trf-1',
        {
          lines: [{ itemId: mockItemId, quantity: 5 }],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should cancel DRAFT transfer and emit STOCK_TRANSFER_CANCELLED', async () => {
    prismaMock.stockTransfer.findFirst.mockResolvedValue({
      id: 'trf-1',
      organizationId: mockOrgId,
      status: StockTransferStatus.DRAFT,
      sourceLocation: { code: 'WH-A' },
      destinationLocation: { code: 'WH-B' },
    });

    prismaMock.stockTransfer.update.mockResolvedValue({
      id: 'trf-1',
      status: StockTransferStatus.CANCELLED,
    });

    const result = await service.cancelTransfer(mockOrgId, 'trf-1', mockUserId);
    expect(result.status).toBe(StockTransferStatus.CANCELLED);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'STOCK_TRANSFER_CANCELLED',
      }),
    );
  });

  it('6. should throw NotFoundException for non-existent transfer', async () => {
    prismaMock.stockTransfer.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'missing-trf')).rejects.toThrow(
      NotFoundException,
    );
  });
});
