import { Test, TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('UnitsService', () => {
  let service: UnitsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockUserId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      unitOfMeasure: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
  });

  it('1. should create a valid unit of measure with uppercase code', async () => {
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue(null);
    prismaMock.unitOfMeasure.create.mockResolvedValue({
      id: 'unit-1',
      organizationId: mockOrgId,
      code: 'KG',
      name: 'Kilogram',
      symbol: 'kg',
      decimalPlaces: 3,
      isActive: true,
    });

    const result = await service.create(
      mockOrgId,
      {
        code: 'kg',
        name: 'Kilogram',
        symbol: 'kg',
        decimalPlaces: 3,
      },
      mockUserId,
    );

    expect(result.code).toBe('KG');
    expect(prismaMock.unitOfMeasure.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: mockOrgId,
        code: 'KG',
        name: 'Kilogram',
        decimalPlaces: 3,
      }),
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'UNIT_CREATED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('2. should reject duplicate unit code in the same organization', async () => {
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: 'unit-1',
      organizationId: mockOrgId,
      code: 'KG',
    });

    await expect(
      service.create(mockOrgId, { code: 'KG', name: 'Kilogram 2' }, mockUserId),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should find single unit of measure by ID', async () => {
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: 'unit-1',
      organizationId: mockOrgId,
      code: 'PCS',
      name: 'Pieces',
    });

    const result = await service.findOne(mockOrgId, 'unit-1');
    expect(result.code).toBe('PCS');
  });

  it('4. should throw NotFoundException when unit is not found', async () => {
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'unit-999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('5. should update unit attributes and emit UNIT_UPDATED', async () => {
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: 'unit-1',
      organizationId: mockOrgId,
      code: 'PCS',
    });
    prismaMock.unitOfMeasure.update.mockResolvedValue({
      id: 'unit-1',
      name: 'Pieces (Updated)',
    });

    const result = await service.update(
      mockOrgId,
      'unit-1',
      { name: 'Pieces (Updated)' },
      mockUserId,
    );

    expect(result.name).toBe('Pieces (Updated)');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'UNIT_UPDATED',
      }),
    );
  });

  it('6. should safely deactivate unit of measure and emit UNIT_DEACTIVATED', async () => {
    prismaMock.unitOfMeasure.findFirst.mockResolvedValue({
      id: 'unit-1',
      organizationId: mockOrgId,
      code: 'BOX',
      name: 'Box',
    });
    prismaMock.unitOfMeasure.update.mockResolvedValue({
      id: 'unit-1',
      isActive: false,
    });

    const result = await service.deactivate(mockOrgId, 'unit-1', mockUserId);
    expect(result.success).toBe(true);
    expect(prismaMock.unitOfMeasure.update).toHaveBeenCalledWith({
      where: { id: 'unit-1' },
      data: { isActive: false },
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'UNIT_DEACTIVATED',
      }),
    );
  });
});
