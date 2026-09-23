import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SupplierContactsService } from './supplier-contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('SupplierContactsService', () => {
  let service: SupplierContactsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockSupplierId = '22222222-2222-2222-2222-222222222222';
  const mockContactId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      supplier: {
        findFirst: jest.fn(),
      },
      supplierContact: {
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
        SupplierContactsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<SupplierContactsService>(SupplierContactsService);
  });

  it('1. should create contact and unset previous primary contacts if isPrimary is true', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: mockSupplierId });
    prismaMock.supplierContact.create.mockResolvedValue({
      id: mockContactId,
      supplierId: mockSupplierId,
      name: 'Alice Johnson',
      email: 'alice@supplier.com',
      isPrimary: true,
    });

    const result = await service.create(mockOrgId, mockSupplierId, {
      name: 'Alice Johnson',
      email: 'alice@supplier.com',
      isPrimary: true,
    });

    expect(result.name).toBe('Alice Johnson');
    expect(prismaMock.supplierContact.updateMany).toHaveBeenCalledWith({
      where: {
        supplierId: mockSupplierId,
        organizationId: mockOrgId,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_CONTACT_CREATED',
      }),
    );
  });

  it('2. should reject contact creation for non-existent supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, 'invalid-supplier', { name: 'Bob' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. should update contact details', async () => {
    prismaMock.supplierContact.findFirst.mockResolvedValue({
      id: mockContactId,
      name: 'Alice Old',
    });
    prismaMock.supplierContact.update.mockResolvedValue({
      id: mockContactId,
      name: 'Alice Updated',
      isPrimary: true,
    });

    const result = await service.update(
      mockOrgId,
      mockSupplierId,
      mockContactId,
      { name: 'Alice Updated', isPrimary: true },
    );

    expect(result.name).toBe('Alice Updated');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_CONTACT_UPDATED',
      }),
    );
  });

  it('4. should delete contact', async () => {
    prismaMock.supplierContact.findFirst.mockResolvedValue({
      id: mockContactId,
      name: 'Alice',
    });
    prismaMock.supplierContact.delete.mockResolvedValue({});

    const result = await service.remove(
      mockOrgId,
      mockSupplierId,
      mockContactId,
    );

    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'SUPPLIER_CONTACT_DELETED',
      }),
    );
  });
});
