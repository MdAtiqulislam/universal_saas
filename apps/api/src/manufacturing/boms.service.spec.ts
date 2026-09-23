import { Test, TestingModule } from '@nestjs/testing';
import { BomsService } from './boms.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BomStatus, Prisma } from '@prisma/client';

describe('BomsService', () => {
  let service: BomsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockItemId = 'item-finished-1';
  const mockRawItem1 = 'item-raw-1';
  const mockRawItem2 = 'item-raw-2';
  const mockUomId = 'uom-pcs-1';

  beforeEach(async () => {
    prisma = {
      item: {
        findFirst: jest.fn(),
      },
      itemVariant: {
        findFirst: jest.fn(),
      },
      unitOfMeasure: {
        findFirst: jest.fn(),
      },
      billOfMaterial: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      billOfMaterialLine: {
        deleteMany: jest.fn(),
      },
      productionOrder: {
        count: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'BOM-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BomsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<BomsService>(BomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a valid BOM successfully', async () => {
      prisma.item.findFirst.mockResolvedValue({
        id: mockItemId,
        organizationId: mockOrgId,
      });
      prisma.unitOfMeasure.findFirst.mockResolvedValue({
        id: mockUomId,
        organizationId: mockOrgId,
      });
      prisma.billOfMaterial.findMany.mockResolvedValue([]);
      prisma.billOfMaterial.findUnique.mockResolvedValue(null);

      const mockCreatedBom = {
        id: 'bom-1',
        organizationId: mockOrgId,
        bomNumber: 'BOM-000001',
        itemId: mockItemId,
        quantity: new Prisma.Decimal(1),
        uomId: mockUomId,
        status: BomStatus.DRAFT,
        lines: [
          {
            itemId: mockRawItem1,
            quantity: new Prisma.Decimal(2),
            uomId: mockUomId,
          },
          {
            itemId: mockRawItem2,
            quantity: new Prisma.Decimal(3),
            uomId: mockUomId,
          },
        ],
      };

      prisma.billOfMaterial.create.mockResolvedValue(mockCreatedBom);

      const result = await service.create(
        mockOrgId,
        {
          name: 'Widget Assembly BOM',
          itemId: mockItemId,
          uomId: mockUomId,
          effectiveFrom: '2026-01-01',
          lines: [
            { itemId: mockRawItem1, quantity: 2, uomId: mockUomId },
            { itemId: mockRawItem2, quantity: 3, uomId: mockUomId },
          ],
        },
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(result.bomNumber).toBe('BOM-000001');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'BOM_CREATED' }),
      );
    });

    it('should reject BOM creation if finished item is not found', async () => {
      prisma.item.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          mockOrgId,
          {
            name: 'Invalid BOM',
            itemId: 'non-existent',
            uomId: mockUomId,
            effectiveFrom: '2026-01-01',
            lines: [{ itemId: mockRawItem1, quantity: 1, uomId: mockUomId }],
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject BOM if component contains the finished product itself (self-reference)', async () => {
      prisma.item.findFirst.mockResolvedValue({
        id: mockItemId,
        organizationId: mockOrgId,
      });
      prisma.unitOfMeasure.findFirst.mockResolvedValue({
        id: mockUomId,
        organizationId: mockOrgId,
      });

      await expect(
        service.create(
          mockOrgId,
          {
            name: 'Recursive BOM',
            itemId: mockItemId,
            uomId: mockUomId,
            effectiveFrom: '2026-01-01',
            lines: [{ itemId: mockItemId, quantity: 1, uomId: mockUomId }],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect and reject indirect circular BOM dependencies', async () => {
      prisma.item.findFirst.mockResolvedValue({
        id: mockItemId,
        organizationId: mockOrgId,
      });
      prisma.unitOfMeasure.findFirst.mockResolvedValue({
        id: mockUomId,
        organizationId: mockOrgId,
      });

      // Sub-BOM for raw-1 contains finished item
      prisma.billOfMaterial.findMany.mockResolvedValue([
        {
          id: 'sub-bom-1',
          itemId: mockRawItem1,
          lines: [{ itemId: mockItemId }],
        },
      ]);

      await expect(
        service.create(
          mockOrgId,
          {
            name: 'Circular BOM',
            itemId: mockItemId,
            uomId: mockUomId,
            effectiveFrom: '2026-01-01',
            lines: [{ itemId: mockRawItem1, quantity: 1, uomId: mockUomId }],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update and immutability', () => {
    it('should reject modifying a BOM that is referenced by active production orders', async () => {
      prisma.billOfMaterial.findFirst.mockResolvedValue({
        id: 'bom-1',
        organizationId: mockOrgId,
        itemId: mockItemId,
        status: BomStatus.ACTIVE,
        lines: [],
      });

      prisma.productionOrder.count.mockResolvedValue(2); // 2 active production orders

      await expect(
        service.update(
          mockOrgId,
          'bom-1',
          { name: 'Updated BOM Name' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('activation and deactivation', () => {
    it('should activate a BOM successfully', async () => {
      prisma.billOfMaterial.findFirst.mockResolvedValue({
        id: 'bom-1',
        organizationId: mockOrgId,
        itemId: mockItemId,
        status: BomStatus.DRAFT,
        lines: [{ itemId: mockRawItem1 }],
      });
      prisma.billOfMaterial.findMany.mockResolvedValue([]);
      prisma.billOfMaterial.update.mockResolvedValue({
        id: 'bom-1',
        status: BomStatus.ACTIVE,
      });

      const result = await service.activate(mockOrgId, 'bom-1', mockUserId);
      expect(result.status).toBe(BomStatus.ACTIVE);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'BOM_ACTIVATED' }),
      );
    });
  });
});
