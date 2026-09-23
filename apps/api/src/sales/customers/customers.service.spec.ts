import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockCustomerId = '22222222-2222-2222-2222-222222222222';
  const mockGroupId = '33333333-3333-3333-3333-333333333333';
  const mockCurrencyId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    prismaMock = {
      customer: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerGroup: {
        findFirst: jest.fn(),
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
        CustomersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('1. should successfully create a customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    prismaMock.customerGroup.findFirst.mockResolvedValue({ id: mockGroupId });
    prismaMock.currency.findFirst.mockResolvedValue({ id: mockCurrencyId });
    prismaMock.customer.create.mockResolvedValue({
      id: mockCustomerId,
      organizationId: mockOrgId,
      code: 'CUST-001',
      name: 'Acme Client Inc',
      paymentTermsDays: 15,
      creditLimit: 5000,
      isActive: true,
    });

    const result = await service.create(mockOrgId, {
      code: 'cust-001',
      name: 'Acme Client Inc',
      customerGroupId: mockGroupId,
      currencyId: mockCurrencyId,
      paymentTermsDays: 15,
      creditLimit: 5000,
    });

    expect(result.code).toBe('CUST-001');
    expect(prismaMock.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'CUST-001',
          name: 'Acme Client Inc',
        }),
      }),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_CREATED',
      }),
    );
  });

  it('2. should reject duplicate customer code within tenant', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({ id: mockCustomerId });

    await expect(
      service.create(mockOrgId, {
        code: 'CUST-001',
        name: 'Duplicate Client',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should reject non-existent customer group', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(null);
    prismaMock.customerGroup.findFirst.mockResolvedValue(null);

    await expect(
      service.create(mockOrgId, {
        code: 'CUST-002',
        name: 'Client',
        customerGroupId: 'invalid-group',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. should list customers with pagination', async () => {
    prismaMock.customer.count.mockResolvedValue(1);
    prismaMock.customer.findMany.mockResolvedValue([
      { id: mockCustomerId, code: 'CUST-001', name: 'Acme Client Inc' },
    ]);

    const result = await service.findAll(mockOrgId, { page: 1, limit: 10 });
    expect(result.customers).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('5. should update customer details', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      name: 'Old Client',
    });
    prismaMock.customer.update.mockResolvedValue({
      id: mockCustomerId,
      name: 'Updated Client',
    });

    const result = await service.update(mockOrgId, mockCustomerId, {
      name: 'Updated Client',
    });

    expect(result.name).toBe('Updated Client');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_UPDATED',
      }),
    );
  });

  it('6. should soft delete customer', async () => {
    prismaMock.customer.findFirst.mockResolvedValue({
      id: mockCustomerId,
      code: 'CUST-001',
    });
    prismaMock.customer.update.mockResolvedValue({});

    const result = await service.softDelete(mockOrgId, mockCustomerId);
    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_DELETED',
      }),
    );
  });
});
