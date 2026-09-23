import { Test, TestingModule } from '@nestjs/testing';
import { CustomerAssetsService } from '../customer-assets/customer-assets.service';
import { ServiceOrdersService } from '../orders/service-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { ServiceQualityIntegrationService } from '../quality/service-quality-integration.service';
import { ServiceCostingService } from '../costing/service-costing.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('Tenant Service Isolation', () => {
  let customerAssetsService: CustomerAssetsService;
  let serviceOrdersService: ServiceOrdersService;
  let prisma: any;

  const tenantA = 'org-aaaa-aaaa-aaaa-aaaa';
  const tenantB = 'org-bbbb-bbbb-bbbb-bbbb';

  beforeEach(async () => {
    prisma = {
      customerAsset: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      serviceOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerAssetsService,
        ServiceOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        {
          provide: NumberingService,
          useValue: {
            nextNumber: jest.fn().mockResolvedValue({ formatted: 'CSA-001' }),
          },
        },
        {
          provide: ServiceQualityIntegrationService,
          useValue: { verifyQualityPass: jest.fn() },
        },
        {
          provide: ServiceCostingService,
          useValue: { recalculateAndPersist: jest.fn() },
        },
      ],
    }).compile();

    customerAssetsService = module.get<CustomerAssetsService>(
      CustomerAssetsService,
    );
    serviceOrdersService =
      module.get<ServiceOrdersService>(ServiceOrdersService);
  });

  it('should not allow Tenant A to access CustomerAsset belonging to Tenant B', async () => {
    prisma.customerAsset.findFirst.mockResolvedValue(null);

    await expect(
      customerAssetsService.findOne(tenantA, 'asset-belonging-to-b'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.customerAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-belonging-to-b', organizationId: tenantA },
      }),
    );
  });

  it('should reject creating a customer asset with a customerId belonging to another tenant', async () => {
    prisma.customer.findFirst.mockResolvedValue(null); // Customer not found under tenant A

    await expect(
      customerAssetsService.create(
        tenantA,
        {
          customerId: 'customer-of-tenant-b',
          itemId: 'item-1',
          purchaseDate: '2026-01-01',
          warrantyStartDate: '2026-01-01',
          warrantyEndDate: '2027-01-01',
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should not allow Tenant A to access ServiceOrder belonging to Tenant B', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);

    await expect(
      serviceOrdersService.findOne(tenantA, 'order-belonging-to-b'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-belonging-to-b', organizationId: tenantA },
      }),
    );
  });
});
