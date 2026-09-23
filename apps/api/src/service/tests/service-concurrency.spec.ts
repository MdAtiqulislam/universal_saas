import { Test, TestingModule } from '@nestjs/testing';
import { ServicePartsService } from '../parts/service-parts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma, ServiceOrderStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Service Concurrency and Stock Reservation Invariants', () => {
  let servicePartsService: ServicePartsService;
  let prisma: any;

  const mockOrgId = 'org-1111-2222-3333-4444';
  const mockOrderId = 'order-1111-2222-3333-4444';
  const mockPartReqId = 'part-1111-2222-3333-4444';

  beforeEach(async () => {
    prisma = {
      servicePartRequirement: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      serviceOrder: {
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicePartsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    servicePartsService = module.get<ServicePartsService>(ServicePartsService);
  });

  it('should prevent over-reservation when multiple concurrent requests attempt to reserve parts exceeding required quantity', async () => {
    prisma.servicePartRequirement.findFirst.mockResolvedValue({
      id: mockPartReqId,
      organizationId: mockOrgId,
      serviceOrderId: mockOrderId,
      requiredQuantity: new Prisma.Decimal('5'),
      reservedQuantity: new Prisma.Decimal('4'), // Only 1 unit left to reserve
      serviceOrder: {
        status: ServiceOrderStatus.RELEASED,
      },
    });

    // Attempting to reserve 2 units when only 1 is available
    await expect(
      servicePartsService.reserveParts(
        mockOrgId,
        mockOrderId,
        {
          partRequirementId: mockPartReqId,
          quantity: 2,
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should prevent returning more parts than have been issued', async () => {
    prisma.servicePartRequirement.findFirst.mockResolvedValue({
      id: mockPartReqId,
      organizationId: mockOrgId,
      serviceOrderId: mockOrderId,
      issuedQuantity: new Prisma.Decimal('3'),
      returnedQuantity: new Prisma.Decimal('2'), // Only 1 unit left to return
      unitCost: new Prisma.Decimal('50'),
      unitPrice: new Prisma.Decimal('80'),
      serviceOrder: {
        status: ServiceOrderStatus.IN_PROGRESS,
        partsCost: new Prisma.Decimal('150'),
        totalCost: new Prisma.Decimal('150'),
        warrantyCost: new Prisma.Decimal('0'),
        customerCharge: new Prisma.Decimal('240'),
      },
    });

    // Attempting to return 2 units when only 1 unit is returnable
    await expect(
      servicePartsService.returnParts(
        mockOrgId,
        mockOrderId,
        {
          partRequirementId: mockPartReqId,
          quantity: 2,
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
