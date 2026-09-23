import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomerAddressesService } from './customer-addresses.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CustomerAddressType } from '@prisma/client';

describe('CustomerAddressesService', () => {
  let service: CustomerAddressesService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockAddressId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      customer: {
        findFirst: jest.fn(),
      },
      customerAddress: {
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
        CustomerAddressesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<CustomerAddressesService>(CustomerAddressesService);
  });

  it('1. should create address and unset previous primary of same type when isPrimary is true', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });
    prismaMock.customerAddress.create.mockResolvedValue({
      id: mockAddressId,
      customerId: mockCustomerId,
      type: CustomerAddressType.BILLING,
      line1: '456 Market St',
      city: 'San Francisco',
      country: 'USA',
      isPrimary: true,
    });

    const result = await service.create(mockOrgId, mockCustomerId, {
      type: CustomerAddressType.BILLING,
      line1: '456 Market St',
      city: 'San Francisco',
      country: 'usa',
      isPrimary: true,
    });

    expect(result.city).toBe('San Francisco');
    expect(prismaMock.customerAddress.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: mockCustomerId,
        organizationId: mockOrgId,
        type: CustomerAddressType.BILLING,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_ADDRESS_CREATED',
      }),
    );
  });

  it('2. should reject address for non-existent customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, 'invalid-customer', {
        line1: '456 Market St',
        city: 'SF',
        country: 'USA',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. should update address details', async () => {
    prismaMock.customerAddress.findFirst.mockResolvedValue({
      id: mockAddressId,
      type: CustomerAddressType.BILLING,
    });
    prismaMock.customerAddress.update.mockResolvedValue({
      id: mockAddressId,
      city: 'Oakland',
    });

    const result = await service.update(
      mockOrgId,
      mockCustomerId,
      mockAddressId,
      { city: 'Oakland' },
    );

    expect(result.city).toBe('Oakland');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_ADDRESS_UPDATED',
      }),
    );
  });

  it('4. should delete address', async () => {
    prismaMock.customerAddress.findFirst.mockResolvedValue({
      id: mockAddressId,
      type: CustomerAddressType.BILLING,
    });
    prismaMock.customerAddress.delete.mockResolvedValue({});

    const result = await service.remove(
      mockOrgId,
      mockCustomerId,
      mockAddressId,
    );

    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_ADDRESS_DELETED',
      }),
    );
  });
});
