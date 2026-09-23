import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockSupplierId = '22222222-2222-2222-2222-222222222222';
  const mockCurrencyId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      supplier: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      currency: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  it('1. should successfully create a new supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    prismaMock.supplier.create.mockResolvedValue({
      id: mockSupplierId,
      organizationId: mockOrgId,
      code: 'SUP-001',
      name: 'Global Tech Supplies',
      legalName: 'Global Tech Supplies Inc',
      isActive: true,
      paymentTermsDays: 30,
    });

    const result = await service.create(mockOrgId, {
      code: 'sup-001',
      name: 'Global Tech Supplies',
      legalName: 'Global Tech Supplies Inc',
      paymentTermsDays: 30,
    });

    expect(result.code).toBe('SUP-001');
    expect(prismaMock.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'SUP-001',
          name: 'Global Tech Supplies',
        }),
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_CREATED',
      }),
    );
  });

  it('2. should reject duplicate supplier code within tenant', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: 'other-id',
      code: 'SUP-001',
    });

    await expect(
      service.create(mockOrgId, {
        code: 'SUP-001',
        name: 'Duplicate Supplier',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should validate currency existence when provided', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    prismaMock.currency.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, {
        code: 'SUP-002',
        name: 'Foreign Supplier',
        currencyId: mockCurrencyId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should list suppliers with pagination', async () => {
    prismaMock.supplier.count.mockResolvedValue(1);
    prismaMock.supplier.findMany.mockResolvedValue([
      {
        id: mockSupplierId,
        code: 'SUP-001',
        name: 'Global Tech Supplies',
      },
    ]);

    const result = await service.findAll(mockOrgId, { page: 1, limit: 10 });
    expect(result.suppliers).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('5. should update an existing supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: mockSupplierId,
      organizationId: mockOrgId,
      code: 'SUP-001',
      name: 'Old Name',
    });
    prismaMock.supplier.update.mockResolvedValue({
      id: mockSupplierId,
      organizationId: mockOrgId,
      code: 'SUP-001',
      name: 'New Name',
    });

    const result = await service.update(mockOrgId, mockSupplierId, {
      name: 'New Name',
    });

    expect(result.name).toBe('New Name');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_UPDATED',
      }),
    );
  });

  it('6. should soft delete supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({
      id: mockSupplierId,
      organizationId: mockOrgId,
      code: 'SUP-001',
      name: 'Global Tech',
    });
    prismaMock.supplier.update.mockResolvedValue({});

    const result = await service.softDelete(mockOrgId, mockSupplierId);
    expect(result.success).toBe(true);
    expect(prismaMock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
        }),
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_DELETED',
      }),
    );
  });

  it('7. should throw NotFoundException when updating non-existent supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);

    await expect(
      service.update(mockOrgId, 'non-existent', { name: 'Test' }),
    ).rejects.toThrow(NotFoundException);
  });
});
