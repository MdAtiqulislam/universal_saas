import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerGroupsService } from './customer-groups.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('CustomerGroupsService', () => {
  let service: CustomerGroupsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockGroupId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    prismaMock = {
      customerGroup: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerGroupsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<CustomerGroupsService>(CustomerGroupsService);
  });

  it('1. should create a customer group', async () => {
    prismaMock.customerGroup.findFirst.mockResolvedValue(null);
    prismaMock.customerGroup.create.mockResolvedValue({
      id: mockGroupId,
      organizationId: mockOrgId,
      code: 'WHOLESALE',
      name: 'Wholesale Buyers',
      isActive: true,
    });

    const result = await service.create(mockOrgId, {
      code: 'wholesale',
      name: 'Wholesale Buyers',
    });

    expect(result.code).toBe('WHOLESALE');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_GROUP_CREATED',
      }),
    );
  });

  it('2. should reject duplicate customer group code within tenant', async () => {
    prismaMock.customerGroup.findFirst.mockResolvedValue({ id: mockGroupId });

    await expect(
      service.create(mockOrgId, {
        code: 'WHOLESALE',
        name: 'Wholesale Buyers',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should update a customer group', async () => {
    prismaMock.customerGroup.findFirst.mockResolvedValue({
      id: mockGroupId,
      name: 'Old Name',
    });
    prismaMock.customerGroup.update.mockResolvedValue({
      id: mockGroupId,
      name: 'New Name',
    });

    const result = await service.update(mockOrgId, mockGroupId, {
      name: 'New Name',
    });

    expect(result.name).toBe('New Name');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_GROUP_UPDATED',
      }),
    );
  });

  it('4. should soft delete a customer group', async () => {
    prismaMock.customerGroup.findFirst.mockResolvedValue({
      id: mockGroupId,
      code: 'WHOLESALE',
    });
    prismaMock.customerGroup.update.mockResolvedValue({});

    const result = await service.softDelete(mockOrgId, mockGroupId);
    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'CUSTOMER_GROUP_DELETED',
      }),
    );
  });

  it('5. should throw NotFoundException when group does not exist', async () => {
    prismaMock.customerGroup.findFirst.mockResolvedValue(null);

    await expect(service.findOne(mockOrgId, 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
