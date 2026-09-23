import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SupplierAddressesService } from './supplier-addresses.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { SupplierAddressType } from '@prisma/client';

describe('SupplierAddressesService', () => {
  let service: SupplierAddressesService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockSupplierId = '22222222-2222-2222-2222-222222222222';
  const mockAddressId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      supplier: {
        findFirst: jest.fn(),
      },
      supplierAddress: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierAddressesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<SupplierAddressesService>(SupplierAddressesService);
  });

  it('1. should create address and unset previous primary of same type when isPrimary is true', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: mockSupplierId });
    prismaMock.supplierAddress.create.mockResolvedValue({
      id: mockAddressId,
      supplierId: mockSupplierId,
      type: SupplierAddressType.BILLING,
      line1: '123 Main St',
      city: 'New York',
      country: 'USA',
      isPrimary: true,
    });

    const result = await service.create(mockOrgId, mockSupplierId, {
      type: SupplierAddressType.BILLING,
      line1: '123 Main St',
      city: 'New York',
      country: 'usa',
      isPrimary: true,
    });

    expect(result.city).toBe('New York');
    expect(prismaMock.supplierAddress.updateMany).toHaveBeenCalledWith({
      where: {
        supplierId: mockSupplierId,
        organizationId: mockOrgId,
        type: SupplierAddressType.BILLING,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_ADDRESS_CREATED',
      }),
    );
  });

  it('2. should reject address for non-existent supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, 'invalid-supplier', {
        line1: '123 Main St',
        city: 'NY',
        country: 'USA',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. should update address details', async () => {
    prismaMock.supplierAddress.findFirst.mockResolvedValue({
      id: mockAddressId,
      type: SupplierAddressType.BILLING,
    });
    prismaMock.supplierAddress.update.mockResolvedValue({
      id: mockAddressId,
      city: 'Boston',
    });

    const result = await service.update(
      mockOrgId,
      mockSupplierId,
      mockAddressId,
      { city: 'Boston' },
    );

    expect(result.city).toBe('Boston');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_ADDRESS_UPDATED',
      }),
    );
  });

  it('4. should delete address', async () => {
    prismaMock.supplierAddress.findFirst.mockResolvedValue({
      id: mockAddressId,
      type: SupplierAddressType.BILLING,
    });
    prismaMock.supplierAddress.delete.mockResolvedValue({});

    const result = await service.remove(
      mockOrgId,
      mockSupplierId,
      mockAddressId,
    );

    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_ADDRESS_DELETED',
      }),
    );
  });
});
