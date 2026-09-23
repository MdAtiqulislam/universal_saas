import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TaxesService } from './taxes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma } from '@prisma/client';

describe('TaxesService', () => {
  let service: TaxesService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = 'org-1111-1111';
  const mockTaxId = 'tax-2222-2222';

  const mockTaxRate = {
    id: mockTaxId,
    organizationId: mockOrgId,
    name: 'Standard VAT',
    code: 'VAT-15',
    rate: new Prisma.Decimal('15.0000'),
    isInclusive: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaMock = {
      taxRate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<TaxesService>(TaxesService);
  });

  describe('create', () => {
    it('1. should create tax rate successfully', async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(null);
      prismaMock.taxRate.create.mockResolvedValue(mockTaxRate);

      const result = await service.create(
        mockOrgId,
        { name: 'Standard VAT', code: 'vat-15', rate: 15, isInclusive: false },
        'user-1',
      );

      expect(result.code).toBe('VAT-15');
      expect(prismaMock.taxRate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          code: 'VAT-15',
          rate: new Prisma.Decimal(15),
        }),
      });
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'TAX_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('2. should reject duplicate tax code within organization', async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(mockTaxRate);

      await expect(
        service.create(mockOrgId, {
          name: 'VAT 15',
          code: 'VAT-15',
          rate: 15,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('3. should reject negative tax rate', async () => {
      await expect(
        service.create(mockOrgId, {
          name: 'Invalid Tax',
          code: 'NEG',
          rate: -5,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne & findAll', () => {
    it('4. should return single tax rate scoped to organization', async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(mockTaxRate);

      const result = await service.findOne(mockOrgId, mockTaxId);
      expect(result.id).toBe(mockTaxId);
      expect(prismaMock.taxRate.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTaxId,
          organizationId: mockOrgId,
          deletedAt: null,
        },
      });
    });

    it('5. should throw NotFoundException when tax rate belongs to another tenant', async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('other-tenant-id', mockTaxId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update & archive', () => {
    it('6. should update tax rate and publish event', async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(mockTaxRate);
      prismaMock.taxRate.update.mockResolvedValue({
        ...mockTaxRate,
        rate: new Prisma.Decimal('17.5000'),
      });

      const result = await service.update(
        mockOrgId,
        mockTaxId,
        { rate: 17.5 },
        'user-1',
      );

      expect(result.rate.toString()).toBe('17.5');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'TAX_UPDATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('7. should archive tax rate by setting isActive to false and setting deletedAt', async () => {
      prismaMock.taxRate.findFirst.mockResolvedValue(mockTaxRate);
      prismaMock.taxRate.update.mockResolvedValue({
        ...mockTaxRate,
        isActive: false,
        deletedAt: new Date(),
      });

      const result = await service.archive(mockOrgId, mockTaxId, 'user-1');

      expect(result.success).toBe(true);
      expect(prismaMock.taxRate.update).toHaveBeenCalledWith({
        where: { id: mockTaxId },
        data: {
          isActive: false,
          deletedAt: expect.any(Date),
        },
      });
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'TAX_ARCHIVED',
          organizationId: mockOrgId,
        }),
      );
    });
  });
});
