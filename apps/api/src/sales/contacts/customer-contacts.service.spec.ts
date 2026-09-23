import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomerContactsService } from './customer-contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('CustomerContactsService', () => {
  let service: CustomerContactsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockContactId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      customer: {
        findFirst: jest.fn(),
      },
      customerContact: {
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
        CustomerContactsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<CustomerContactsService>(CustomerContactsService);
  });

  it('1. should create contact and unset previous primary contacts if isPrimary is true', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });
    prismaMock.customerContact.create.mockResolvedValue({
      id: mockContactId,
      customerId: mockCustomerId,
      name: 'John Doe',
      email: 'john@customer.com',
      isPrimary: true,
    });

    const result = await service.create(mockOrgId, mockCustomerId, {
      name: 'John Doe',
      email: 'john@customer.com',
      isPrimary: true,
    });

    expect(result.name).toBe('John Doe');
    expect(prismaMock.customerContact.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: mockCustomerId,
        organizationId: mockOrgId,
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_CONTACT_CREATED',
      }),
    );
  });

  it('2. should reject contact creation for non-existent customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, 'invalid-customer', { name: 'Bob' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('3. should update contact details', async () => {
    prismaMock.customerContact.findFirst.mockResolvedValue({
      id: mockContactId,
      name: 'John Old',
    });
    prismaMock.customerContact.update.mockResolvedValue({
      id: mockContactId,
      name: 'John Updated',
      isPrimary: true,
    });

    const result = await service.update(
      mockOrgId,
      mockCustomerId,
      mockContactId,
      { name: 'John Updated', isPrimary: true },
    );

    expect(result.name).toBe('John Updated');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_CONTACT_UPDATED',
      }),
    );
  });

  it('4. should delete contact', async () => {
    prismaMock.customerContact.findFirst.mockResolvedValue({
      id: mockContactId,
      name: 'John',
    });
    prismaMock.customerContact.delete.mockResolvedValue({});

    const result = await service.remove(
      mockOrgId,
      mockCustomerId,
      mockContactId,
    );

    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_CONTACT_DELETED',
      }),
    );
  });
});
